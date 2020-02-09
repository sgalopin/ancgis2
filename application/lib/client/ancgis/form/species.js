// Requirements
import speciesFormTemplate from "../../../views/partials/form/species.hbs";
import * as log from "loglevel";

/**
 * Species form builder.
 */
export default async function(idbm, isOnline) {

  return {
    show() {

      // Manage the validation of the form
      function validateForm () {
        // Check the recovery field value
        var rf = $("#ancgis-speciesform-recoveryfield");
        let recovery = Number(rf.val());
        recovery === 0 && (recovery = 100); // Set default value to 100
        if (recovery < 0 || recovery > 100) {
          // TODO: Print an error message
          log.error(Error("Bad recovery value"));
        } else {
          // Get the taxon fields
          idbm.read("taxons", Number($("#ancgis-speciesform-taxonfield").val()))
          .then(function(taxon) {
            // Fire the end event
            $("#ancgis-zoneform").trigger("speciesFormValidated", { taxon, recovery });
            $("#ancgis-speciesform").remove();
            $("#ancgis-zoneform").show( 0, function() {
              $("#ancgis-zoneform").focus();
            });
          }, function(err) {
            log.error(err);
          });
        }
      }

      // Get the taxon fields
      idbm.readAll("taxons")
      .then(function(taxons) {
        // Split the taxon name
        let splitedTaxons = [];
        taxons.forEach(function(taxon){
          let taxonNames = taxon.name.fr.split(', ');
          taxonNames.forEach(function(taxonName, index){
            splitedTaxons.push({
              id: taxon.id,
              name: taxonName,
              synonymous: index !== 0,
              smartflore: taxon.urns.fr.telabotanica
            });
          });
        });

        // HTML builds
        var speciesFormHtml = speciesFormTemplate({ isOnline, taxons: splitedTaxons });
        $("body").append(speciesFormHtml);
        $("#ancgis-speciesform [data-toggle=\"tooltip\"]").tooltip();
        $("#ancgis-speciesform").focus();

        // keys handler
        // Note: "keypress" doesn't seem to be handled consistently
        // between browsers whereas keyup is consistent.
        $("#ancgis-speciesform-taxonfield").on("keypress", function (event) {
            event.stopPropagation();
            event.preventDefault();
          });
        $("#ancgis-speciesform, #ancgis-speciesform-taxonfield, #ancgis-speciesform-recoveryfield").on("keyup", function (event) {
          if (event.keyCode === 27) { // ESC
            event.stopPropagation();
            event.preventDefault();
            $("#ancgis-speciesform").remove();
            $("#ancgis-zoneform").show( 0, function() {
              $("#ancgis-zoneform").focus();
            });
          } else if (event.keyCode === 13) { // ENTER
            event.stopPropagation();
            event.preventDefault();
            validateForm();
          }
        });
        $("#ancgis-speciesform-taxonfield").change( function(event) {
          event.stopPropagation();
          event.preventDefault();
          $(this).find(":selected").each(function () {
            if (isOnline) {
              $("#ancgis-speciesform-taxonfield-trigger").show();
              $("#ancgis-speciesform-taxonfield-loadingdiv").show();
              $("#ancgis-speciesform-taxonfield-iframe").hide();
              $("#ancgis-speciesform-taxonfield-iframe").prop("src","/smartflore/" + $(this).data("smartflore"));
            }
          });
        });

        // Add taxonfield trigger handler
        $("#ancgis-speciesform-taxonfield-trigger").click(function(event) {
          event.stopPropagation();
          if (isOnline) {
            $(this).toggleClass("active");
            let span = $(this).children(":first");
            if ($(this).hasClass("active")) {
              span.addClass("ancgis-glyphicons-546eyeclose");
              span.removeClass("ancgis-glyphicons-546eyeopen");
              $("#ancgis-speciesform").addClass("enlarged");
              $("#ancgis-speciesform-taxonfield-frame").show();
            } else {
              span.addClass("ancgis-glyphicons-546eyeopen");
              span.removeClass("ancgis-glyphicons-546eyeclose");
              $("#ancgis-speciesform").removeClass("enlarged");
              $("#ancgis-speciesform-taxonfield-frame").hide();
            }
          }
        });

        // Add taxonfield iframe handler
        $('#ancgis-speciesform-taxonfield-iframe').on("load", function() {
            $("#ancgis-speciesform-taxonfield-loadingdiv").hide();
            $("#ancgis-speciesform-taxonfield-iframe").show();
        });

        // Cancel button handler
        $("#ancgis-speciesform-cancelbtn").on("click", function(event) {
          event.stopPropagation();
          $("#ancgis-speciesform").remove();
          $("#ancgis-zoneform").show( 0, function() {
            $("#ancgis-zoneform").focus();
          });
        });

        // Validate button handler
        $("#ancgis-speciesform-validatebtn").on("click", function(event) {
          event.stopPropagation();
          validateForm();
        });
      }, function(err) { // Catch the "readAll" function error
        log.error(err);
      })
      .catch(function(err) { // Catch the "then" function error
        log.error(err);
      });
    }
  };
}