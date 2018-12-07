import {setCookie, getCookie, hasVerifiedJWT, deleteCookie, getUserInfo} from "./ancgis/tool/cookie.js";
import sigPageTemplate from "../views/subpages/sig.hbs";
import loginPageTemplate from "../views/subpages/login.hbs";
import getSig from "./ancgis/map/sig.js";
import {confirm} from "./ancgis/tool/modal.js";
import jwt from "jsonwebtoken";
import {displayLoginMessage} from "./ancgis/tool/message.js";
import {addServiceWorker} from "./ancgis/tool/service-worker.js";
import * as log from "loglevel";
import Env from '@environment';

$(document).ready(function(){

  log.setLevel(Env.LOGLEVEL); // Logging is filtered to "warn" level by default.

  function bootstrapSetup() {
    // Tooltip activation
    $("[data-toggle=\"tooltip\"]").tooltip({
      trigger : "hover"
    });
    // Removes focus of the button.
    $(".btn").click(function(){
      $(this).blur();
    });
  }

  function updatePage(pageTemplate, data) {
    if ($(".page-container")) {
      $(".page-container").remove();
    }
    $("#current-page").append(pageTemplate(data));
    bootstrapSetup();
  }

  function disconnect() {
    // server logout
    $.ajax({
      type: "GET",
      url: "/logout",
      dataType: "json",
      success (response) {
        document.location.href = "/";
      },
      error (jqXHR, textStatus, errorThrown) {
        if (jqXHR.readyState === 0) { // Network error
          // local logout
          deleteCookie("jwt");
          document.location.href = "/";
        }
        else if (jqXHR.readyState === 4) {
          // HTTP error (can be checked by jqXHR.status and jqXHR.statusText)
          displayLoginMessage("La demande de déconnexion a echouée suite à une erreur HTTP.", "error", true);
        }
        else {
          // something weird is happening
          displayLoginMessage("La demande de déconnexion a echouée suite à une erreur inconnue.", "error", true);
        }
        log.error( "Request Failed with status : " + textStatus );
        if (errorThrown) { log.error(errorThrown); }
      }
    });
  }

  async function openSIGPage(isOnline = false) {
    // Adds the sig page (static part)
    updatePage(sigPageTemplate, {user: getUserInfo(), isOnline});
    // Adds the sig page (dynamic part)
    getSig(isOnline);

    // Management of the logout button
    $("#ancgis-topright-logout, #ancgis-topright-logout2").click(function() {
      confirm("Confirmez-vous la déconnexion ? Attention, l'authentification requiert une connexion.").then(
        disconnect,
        $.noop
      );
    });
  }

  function openLoginPage() {
    // Display the login page
    updatePage(loginPageTemplate);
    $("#login-form").bind("submit", function(e) {
      e.preventDefault();
      // Remote authentification
      $.ajax({
        type: "POST",
        url: $("#login-form").prop("action"),
        data: $("#login-form").serialize(),
        dataType: "json",
        success(response) {
          if (response.success === true && hasVerifiedJWT("jwt")) {
            openSIGPage(true); // true for online
            // Add Service worker for cache
            addServiceWorker();
          } else {
            displayLoginMessage(response.message, "error", true);
          }
        },
        error(jqXHR, textStatus, errorThrown) { // eslint-disable-line complexity
          if (jqXHR.readyState === 0) {
            // Local authentification
            if (hasVerifiedJWT("jwt")) {
              openSIGPage();
            } else {
              // Network error (i.e. connection refused, access denied due to CORS, etc.)
              displayLoginMessage("La demande de connexion a echouée suite à une erreur réseau.", "error", true);
            }
          } else if (jqXHR.readyState === 4) {
            // HTTP error (can be checked by jqXHR.status and jqXHR.statusText)
            displayLoginMessage("La demande de connexion a echouée suite à une erreur HTTP.", "error", true);
          } else {
            // something weird is happening
            displayLoginMessage("La demande de connexion a echouée suite à une erreur inconnue.", "error", true);
          }
          log.error( "Request Failed with status : " + textStatus );
          if (errorThrown) { log.error(errorThrown); }
        }
      });
    });
  }

  openLoginPage();

});
