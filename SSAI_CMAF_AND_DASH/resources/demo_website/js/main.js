'use strict';
var hlsjsConfig = {
  "maxBufferSize": 0,
  "maxBufferLength": 4,
  "liveSyncDuration": 4,
  "liveMaxLatencyDuration": Infinity
}
var player_hls = new Hls(hlsjsConfig);
var player_dash = dashjs.MediaPlayer().create();
player_dash.initialize(document.querySelector("#my_video"), "", true);



// Configuration
let sessionUrlHls = '';
let sessionUrlDash = '';
let urlToGet = '';
let currentStream = '';
const HLS_STREAM = "hls";
const DASH_STREAM = "dash";




let startApp = function(){
  $('#hls').on('change', function () {
    console.log(HLS_STREAM);
    currentStream = HLS_STREAM;
    player_hls = new Hls(hlsjsConfig);
    player_dash.reset()
    load(HLS_STREAM);

   });
   
   $('#dash').on('change', function () {
     console.log(DASH_STREAM);
     currentStream = DASH_STREAM;
     player_hls.destroy()
     load(DASH_STREAM);
   
   });
   load('hls');
}
// Update values
fetch('config.json')
.then(response => response.json())
.then(data => {
  sessionUrlHls = data.sessionURLHls;
  sessionUrlDash = data.sessionURLDash;
  startApp()
});





function load(type) {
  putStreamTypeLabel(type)
  resetAllDivText();

  if(type =='hls'){
    urlToGet=sessionUrlHls
  }else{
    urlToGet=sessionUrlDash
  }
  var inputData={"reportingMode": "server", "playerParams": {"segment_prefix": type,"ad_segment_prefix": type}}
  $.ajax({
    type: 'POST',
    url: urlToGet,
    data:  JSON.stringify(inputData),
    contentType: 'application/json; charset=utf-8',
    success: function (data, status, xhr) {
      showResultDiv();
      showVideo();
      hideErrorDiv();
      var manifestUri=data.manifestUrl //get session Id
      let domain = (new URL(urlToGet));
      domain = domain.hostname; // get Hostname from URL
      var sessionUrl="https://"+domain+manifestUri
      var manifest_url = sessionUrl;
      $("#playback_url_value").text(manifest_url);
      if(type =='hls'){
        if (Hls.isSupported()) {
          var video = document.getElementById('my_video');
          player_hls.loadSource(manifest_url);
          player_hls.attachMedia(video);
          video.play()
        }
        // HLS.js is not supported on platforms that do not have Media Source
        // Extensions (MSE) enabled.
        //
        // When the browser has built-in HLS support (check using `canPlayType`),
        // we can provide an HLS manifest (i.e. .m3u8 URL) directly to the video
        // element through the `src` property. This is using the built-in support
        // of the plain video element, without using HLS.js.
        //
        // Note: it would be more normal to wait on the 'canplay' event below however
        // on Safari (where you are most likely to find built-in HLS support) the
        // video.src URL must be on the user-driven white-list before a 'canplay'
        // event will be emitted; the last video event that can be reliably
        // listened-for when the URL is not on the white-list is 'loadedmetadata'.
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoSrc;
        }
      }else{
        player_dash.initialize(document.querySelector("#my_video"), manifest_url, true);
      }
      
    },
    error: function (data, status, xhr) {

      if (data.status == 404) {
        //not found
        showVideoError("Video asset not configured for " + type.toUpperCase()+ " !")
        showVideoErrorDiv();
        showResultDiv();
        hideVideo();

      } else {
        //different error
        $("#errorAsset").text("Unknown error!");

        showVideoErrorDiv();
        showResultDiv();

      }
      resetAllDivText();

    }
  });


}

function putStreamTypeLabel(stream_type) {
  $("#stream_type").text(stream_type.toUpperCase() + ' stream');

}

function putStreamTypeLabel(stream_type) {
  $("#stream_type").text(stream_type.toUpperCase() + ' stream');

}
function resetAllDivText() {
  $("#request_url_value").text('');
  $("#playback_url_value").text('');
  $('#jwt_header').text('');
  $('#jwt_payload').html('');
}



function showVideoMetadata(playbackUrl) {

  $("#playback_url_value").text(playbackUrl);
  $('#jwt_header').html(jwtHeader);
  $('#jwt_payload').html(jwtPayload);
}

function showVideoError(errorMsg) {
  $("#errorAsset").text(errorMsg);
}
function showResultDiv() {
  $("#result").removeClass('d-none');
  $("#metadataDiv").removeClass('d-none');
}

function hideVideo(){
  $("#video_div").addClass('d-none');
  $("#metadataDiv").addClass('d-none');
}
function showVideo(){
  $("#video_div").removeClass('d-none');
  $("#metadataDiv").removeClass('d-none');
}

function showVideoErrorDiv() {
  $("#errorAsset").removeClass('d-none');
}

function hideErrorDiv() {
  $("#errorMsg").addClass('d-none');
  $("#errorAsset").addClass('d-none');
}


