# Copyright (c) 2012 Kaj Magnus Lindberg. All rights reserved

d = i: debiki.internal, u: debiki.v0.util
$ = d.i.$;


/**
 * Opens a new unsaved page in a new browser tab.
 *
 * You need to open the `preOpenedNewTab` directly in response to
 * a user action (mouse click), or browser popup blockers tend to
 * block the new tab. Alternatively, you could specify the current
 * `window` (which is already open, obviously).
 */
d.i.createChildPage = !({ pageRole, parentPageId, status }, preOpenedNewTab) ->

  # Warning: Dupl code. See client/spa/admin/module-and-services.ls,
  # function getViewNewPageUrl().

  # Open new tab directly in response to user click, or browser popup
  # blockers tend to block the new tab.
  newTab = preOpenedNewTab || window.open '', '_blank'

  # We'll create the new page in the same folder as the current page.
  # (?get-view-new-page-url works with folders only.)
  folder = d.i.parentFolderOfPage window.location.pathname

  slug = switch pageRole
    | 'BlogPost' => 'new-blog-post'
    | 'ForumTopic' => 'new-forum-topic'
    | _ => 'new-page'

  # Ask the server if it's okay to create the page. If it is, the server
  # generates a page id — and also a link where we can view the
  # new unsaved page. We'll open that link in `newTab` (at the very end
  # of this function).
  getViewNewPageUrl =
      folder +
      '?get-view-new-page-url' +
      "&pageSlug=#slug" +
      "&pageRole=#pageRole" +
      '&showId=t'

  parentPageId = d.i.pageId if !parentPageId
  getViewNewPageUrl += "&parentPageId=#parentPageId" if parentPageId
  getViewNewPageUrl += '&status=' + status if status

  $.getJSON(getViewNewPageUrl).done !({ viewNewPageUrl }) ->
    newTab.location = viewNewPageUrl



# vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
