/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="prelude.ts" />
/// <reference path="me-getters.ts" />
/// <reference path="utils/utils.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------


export function store_thisIsMyPage(store: Store): boolean {
  const page: Page = store.currentPage;
  if (!page || !store.me.id) return false;
  const bodyOrTitle = page.postsByNr[BodyNr] || page.postsByNr[TitleNr];
  // If !bodyOrTitle, is an auto page, e.g. user profile or admin area.
  return bodyOrTitle && store.me.id === bodyOrTitle.authorId;
}


export function store_getAuthorOrMissing(store: Store, post: Post): BriefUser {
  const user = store_getUserOrMissing(store, post.authorId, false);
  if (user.isMissing) logError("Author " + post.authorId + " missing, page: " +
      store.currentPageId + ", post nr: " + post.nr + " [EsE6TK2R0]");
  return user;
}


export function store_getUserOrMissing(store: Store, userId: UserId, errorCode2): BriefUser {
  const user = store.usersByIdBrief[userId];
  if (!user) {
    if (errorCode2) logError("User " + userId + " missing, page: " + store.currentPageId +
        ' [EsE38GT2R-' + errorCode2 + ']');
    return {
      id: userId,
      // The first char is shown in the avatar image [7ED8A2M]. Use a square, not a character,
      // so it'll be easier to debug-find-out that something is amiss.
      fullName: "□ missing, id: " + userId + " [EsE4FK07_]",
      isMissing: true,
    };
  }
  return user;
}


export function store_isUserOnline(store: Store, userId: UserId): boolean {
  return store.userIdsOnline && store.userIdsOnline[userId];
}


export function store_getPageMembersList(store: Store): BriefUser[] {
  const page: Page = store.currentPage;
  return page.pageMemberIds.map(id => store_getUserOrMissing(store, id, 'EsE4UY2S'));
}


export function store_getUsersOnThisPage(store: Store): BriefUser[] {
  const page: Page = store.currentPage;
  const users: BriefUser[] = [];
  _.each(page.postsByNr, (post: Post) => {
    if (_.every(users, u => u.id !== post.authorId)) {
      const user = store_getAuthorOrMissing(store, post);
      users.push(user);
    }
  });
  return users;
}


export function store_getUsersOnline(store: Store): BriefUser[] {
  const users = [];
  _.forOwn(store.userIdsOnline, (alwaysTrue, userIdString: string) => {
    let userId: UserId = parseInt(userIdString);
    dieIf(!alwaysTrue, 'EsE7YKW2');
    const user = store_getUserOrMissing(store, userId, 'EsE5GK0Y');
    if (user) users.push(user);
  });
  return users;
}


export function store_getUsersHere(store: Store): UsersHere {
  const page: Page = store.currentPage;
  const isChat = page_isChatChannel(page.pageRole);
  let users: BriefUser[];
  const listMembers = isChat;
  const listUsersOnPage = !listMembers && page_isDiscussion(page.pageRole);
  if (listMembers) {
    users = store_getPageMembersList(store);
  }
  else if (listUsersOnPage) {
    users = store_getUsersOnThisPage(store);
  }
  else {
    users = store_getUsersOnline(store);
  }
  let numOnline = 0;
  let iAmHere = false;
  _.each(users, (user: BriefUser) => {
    numOnline += store_isUserOnline(store, user.id) ? 1 : 0;
    iAmHere = iAmHere || user.id === store.me.id;
  });
  return {
    users: users,
    areChatChannelMembers: listMembers,
    areTopicContributors: listUsersOnPage,
    numOnline: numOnline,
    iAmHere: iAmHere,
    onlyMeOnline: iAmHere && numOnline === 1,
  };
}


export function store_canDeletePage(store: Store): boolean {
  const page: Page = store.currentPage;
  // For now, don't let people delete sections = their forum — that just makes them confused.
  // Unless there are many sub communities — then let them delete all but one.
  return !page.pageDeletedAtMs && isStaff(store.me) &&
      page.pageRole && (!isSection(page.pageRole) || store_numSubCommunities(store) > 1);
}


export function store_canUndeletePage(store: Store): boolean {
  const page: Page = store.currentPage;
  return page.pageDeletedAtMs && isStaff(store.me);
}


export function store_canSelectPosts(store: Store): boolean {
  const page: Page = store.currentPage;
  return isStaff(store.me) && !store_isSection(store) && page.pageRole !== PageRole.CustomHtmlPage;
}


// Returns the current category, or if none, the default category.
//
export function store_getCurrOrDefaultCat(store: Store): Category {
  const currCatId = store.currentPage.categoryId;
  const currCat = _.find(store.currentCategories, (c: Category) => c.id === currCatId);
  if (currCat)
    return currCat;

  // Apparently we're showing all categories, haven't selected any specific category.
  return _.find(store.currentCategories, (c: Category) => c.isDefaultCategory);
}


export function store_isSection(store: Store): boolean {
  const page: Page = store.currentPage;
  return page.pageRole !== PageRole.Blog && page.pageRole !== PageRole.Forum;
}


export function store_numSubCommunities(store: Store): number {
  const forumPages = _.filter(store.siteSections, (s: SiteSection) => s.pageRole === PageRole.Forum);
  return forumPages.length;
}


export function store_thereAreFormReplies(store: Store): boolean {
  const page: Page = store.currentPage;
  return _.some(page.postsByNr, (post: Post) => {
    return post.postType === PostType.CompletedForm;
  });
}


export function store_shallShowPageToolsButton(store: Store) {
  return store_canPinPage(store) || store_canDeletePage(store) || store_canUndeletePage(store);
}


export function store_canPinPage(store: Store) {
  const page: Page = store.currentPage;
  return page.categoryId && page.pageRole !== PageRole.Forum && !page.pageDeletedAtMs;
}


// Use for responsive layout, when you need the page width (excluding watchbar and contextbar).
// Avoid $().width() or elem.getBoundingClientRect() because they force a layout reflow,
// which makes the initial rendering of the page take longer (about 30ms longer = 8% longer,
// as of September 2016, core i7 laptop).
//
// Could use https://github.com/marcj/css-element-queries/, but store_getApproxPageWidth() is
// probably faster (since doesn't need to ask the browser about anything, no layout
// reflows needed), and simpler too (a lot less code, in total).
//
export function store_getApproxPageWidth(store: Store) {   // [6KP024]
  if (isServerSide())
    return ServerSideWindowWidth;

  // outerWidth supposedly doesn't force a reflow (and I've verified in Chrome Dev Tools Timeline
  // that it doesn't). So use it instead of innerWidth — they might differ perhaps 10 pixels
  // because of browser window borders (or what else? There are no window scrollbars [6GKF0WZ]).
  const browserWidth = window.outerWidth;
  let width = browserWidth;
  if (store.isWatchbarOpen) {
    width -= WatchbarWidth;
  }
  if (store.isContextbarOpen) {
    let contextbarWidth = browserWidth * 0.25;  // 0.25 is dupl in css [5RK9W2]
    if (contextbarWidth < ContextbarMinWidth) {
      contextbarWidth = ContextbarMinWidth;
    }
    width -= contextbarWidth;
  }
  // This is not the exact width in pixels, unless the browser window is in full screen so that
  // there are no browser window borders.
  return width;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
