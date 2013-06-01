/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import ApiActions._
import Prelude._
import SafeActions.{ExceptionAction, ExceptionActionNoBody}
import BrowserPagePatcher.PostPatchSpec


/** Handles the initial setup of a server: creates the very first website
  * and a related admin account.
  *
  * 1. Asks you to find a password in the server log files, to prove that you are
  * really the one that installs the server (in case the server is open to the internet).
  *
  * 2. Asks you to create an account, or login via e.g. OpenID. This account will
  * be the site's owner and admin account. — You can login via Gmail (OpenID) and
  * use 2-step verification; this is very secure.
  *
  * 3. Shows an all-done page with a link to the admin dashboard.
  */
object AppInstall extends mvc.Controller {


  /** A password the server admin needs to specify when creating the very first site.
    * It's public so it can be accessed from the ServerInstallationSpec.
    * For now, assume we're using one application server only: use a server local
    * create-first-site password.
    */
  val firstSitePassword = nextRandomString() take 15

  private val firstSiteOwnerPassword = nextRandomString() take 15

  private val FirstSitePasswordCookieName = "dwCoFirstSitePswd"


  def viewInstallationPage() = ExceptionActionNoBody { request =>
    Debiki.systemDao.checkInstallationStatus() match {
      case InstallationStatus.CreateFirstSite =>
        showPasswordInputLogPassword(request)

      case InstallationStatus.CreateFirstSiteAdmin if !okPassCookie(request) =>
        showPasswordInputLogPassword(request)

      case InstallationStatus.CreateFirstSiteAdmin =>
        val xsrfToken = nextRandomString() take 20
        val xsrfCookie = urlEncodeCookie(DebikiSecurity.XsrfCookieName, xsrfToken)

        Ok(views.html.login(xsrfToken = xsrfToken,
          returnToUrl = routes.AppInstall.createFirstSiteOwner(firstSiteOwnerPassword).url,
          showCreateAccountOption = true,
          title = "Installation",
          message = Some("The website needs an administrator."),
          providerLoginMessage = "That account will become the website owner account."))
          .withCookies(xsrfCookie)

      case InstallationStatus.AllDone =>
        OkAllDone(request.host)
    }
  }


  private def showPasswordInputLogPassword(request: mvc.Request[_]) = {
    Logger("app.installation.password").info(i"""
      |==============================================
      |The installation password:  $firstSitePassword
      |==============================================
      """)
    Ok(views.html.install.createFirstSite(request.host).body) as HTML
  }


  def createFirstSite = ExceptionAction(parse.json(maxLength = 100)) { request =>
    val passCookie = throwIfBadPasswordElseCreatePassCookie(request)

    if (Debiki.systemDao.checkInstallationStatus() == InstallationStatus.CreateFirstSite)
      doCreateFirstSite(request)

    // When we reply OK, a related AngularJS app will reload the page, and
    // viewInstallationPage() (just above) will be called again, and notice that
    // now a site has been created.
    Ok.withCookies(passCookie)
  }


  private def throwIfBadPasswordElseCreatePassCookie(request: mvc.Request[JsValue]): mvc.Cookie = {
    val jsonMap = request.body.validate[Map[String, String]] recoverTotal { e =>
      throwBadReq("DwE39bK7", s"Bad JSON: ${JsError.toFlatJson(e)}")
    }

    val password = jsonMap("password")
    if (password != firstSitePassword)
      throwForbidden("DwE74Bi0", "Bad create-first-site password")

    urlEncodeCookie(FirstSitePasswordCookieName, firstSitePassword)
  }


  private def okPassCookie(request: mvc.Request[_]) = {
    val anyCookie = request.cookies.get(FirstSitePasswordCookieName)
    anyCookie.map(_.value) == Some(firstSitePassword)
  }


  private def doCreateFirstSite(request: mvc.Request[JsValue]) {
    val now = new ju.Date()

    val siteConfigPage = AppCreateWebsite.makeConfigPage(
      text = views.txt.install.firstSiteConfigPageText(DefaultThemeConfigPath).body,
      path = s"/${ConfigValueDao.WebsiteConfigPageSlug}", siteId = "?", creationDati = now)

    val defaultThemeConfigPage = AppCreateWebsite.makeConfigPage(
      text = views.txt.install.defaultThemeConfigPageText().body,
      path = DefaultThemeConfigPath, siteId = "?", creationDati = now)

    val firstSiteData = new FirstSiteData {
      val name = "Main Website"
      val address = request.host
      val https = TenantHost.HttpsNone
      val pagesToCreate = siteConfigPage :: defaultThemeConfigPage :: Nil
    }

    Debiki.systemDao.createFirstSite(firstSiteData)
  }


  def createFirstSiteOwner(password: String) = GetAction { apiReq =>
    if (!okPassCookie(apiReq.request))
      throwForbidden("DwE7G304", "Bad create-first-site password cookie")

    // Perhaps this 1) isn't needed (the cookie check above suffice?) and 2) is not totally
    // safe  anyway, since the  password was sent to the OpenID/OAuth provider (it's included
    // in the return-to query string parameter). But why remove this extra check?
    if (password != firstSiteOwnerPassword)
      throwForbidden("DwE4dH09", "Bad create-first-site-owner password")

    if (Debiki.systemDao.checkInstallationStatus() != InstallationStatus.CreateFirstSiteAdmin)
      throwForbidden("DwE2HDS8", "The first site owner account has already been created")

    apiReq.dao.configRole(apiReq.loginId_!, apiReq.ctime, roleId = apiReq.user_!.id,
      isAdmin = Some(true), isOwner = Some(true), emailNotfPrefs = Some(EmailNotfPrefs.Receive))

    OkAllDone(apiReq.host)
  }


  def OkAllDone(host: String) =
    Ok(views.html.install.allDone(host).body) as HTML


  private val DefaultThemeConfigPath = "/themes/default-2012-10-09/theme.conf"

}

