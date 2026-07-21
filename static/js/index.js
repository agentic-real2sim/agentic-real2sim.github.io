window.HELP_IMPROVE_VIDEOJS = false;

$(document).ready(function() {
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
      slidesToScroll: 1,
      slidesToShow: 1,
      loop: true,
      infinite: false,
      autoplay: false,
      autoplaySpeed: 3000,
      breakpoints: [],
    };

		// Initialize all div with carousel class.
    var carousels = bulmaCarousel.attach('.carousel', options);

    function setupVideoPair(pair) {
      var videos = Array.prototype.slice.call(pair.querySelectorAll('video'));
      console.assert(videos.length === 2, 'Each carousel item must contain one real/synthetic pair.');

      var realVideo = videos[0];
      var simulatedVideo = videos[1];
      var state = {
        active: false,
        playAttempt: 0,
        restartAttempt: 0,
        restarting: false,
        started: false,
        syncedSeekTarget: null,
      };
      var frameDuration = 1 / 12;

      function pairedVideo(video) {
        return video === realVideo ? simulatedVideo : realVideo;
      }

      function commonDuration() {
        return Math.min(realVideo.duration, simulatedVideo.duration);
      }

      function clampedTime(time) {
        var duration = commonDuration();
        if (!Number.isFinite(duration)) return Math.max(0, time);
        return Math.min(Math.max(0, time), Math.max(0, duration - 0.001));
      }

      function pauseTogether() {
        state.playAttempt += 1;
        videos.forEach(function(video) {
          video.pause();
        });
      }

      function playTogether() {
        var attempt = ++state.playAttempt;
        var playRequests = videos.map(function(video) {
          return video.play();
        });

        return Promise.all(playRequests).catch(function(error) {
          if (attempt !== state.playAttempt) return;
          pauseTogether();
          if (error.name !== 'NotAllowedError') {
            console.error('Unable to play synchronized carousel videos.', error);
          }
        });
      }

      function restartTogether() {
        if (state.restarting) return;

        var restartAttempt = ++state.restartAttempt;
        state.restarting = true;
        resetTogether();
        playTogether().then(function() {
          window.setTimeout(function() {
            if (restartAttempt === state.restartAttempt) state.restarting = false;
          }, Math.ceil(frameDuration * 1000));
        });
      }

      function resetTogether() {
        videos.forEach(function(video) {
          if (video.readyState > 0) video.currentTime = 0;
        });
      }

      function startWhenReady() {
        if (!state.active || state.started) return;
        if (!videos.every(function(video) { return video.readyState > 0; })) return;

        state.started = true;
        resetTogether();
        playTogether();
      }

      videos.forEach(function(video) {
        video.addEventListener('loadedmetadata', startWhenReady);

        video.addEventListener('seeking', function() {
          if (!state.active || state.restarting || state.syncedSeekTarget === video) return;

          var partner = pairedVideo(video);
          var time = clampedTime(video.currentTime);
          if (Math.abs(partner.currentTime - time) <= 0.01) return;

          state.syncedSeekTarget = partner;
          partner.currentTime = time;
        });

        video.addEventListener('seeked', function() {
          if (state.syncedSeekTarget === video) state.syncedSeekTarget = null;
        });

        video.addEventListener('play', function() {
          if (!state.active || state.restarting) return;
          var partner = pairedVideo(video);
          if (partner.paused) playTogether();
        });

        video.addEventListener('pause', function() {
          if (!state.active || state.restarting || video.ended) return;
          var partner = pairedVideo(video);
          if (!partner.paused) pauseTogether();
        });

        video.addEventListener('ended', function() {
          if (!state.active) return;
          restartTogether();
        });
      });

      realVideo.addEventListener('timeupdate', function() {
        if (!state.active || state.restarting || realVideo.paused || simulatedVideo.paused) return;
        if (Math.abs(realVideo.currentTime - simulatedVideo.currentTime) <= frameDuration) return;

        state.syncedSeekTarget = simulatedVideo;
        simulatedVideo.currentTime = clampedTime(realVideo.currentTime);
      });

      return {
        activate: function() {
          state.restartAttempt += 1;
          state.restarting = false;
          state.active = true;
          state.started = false;
          pauseTogether();
          resetTogether();
          startWhenReady();
        },
        deactivate: function() {
          state.restartAttempt += 1;
          state.restarting = false;
          state.active = false;
          state.started = false;
          state.syncedSeekTarget = null;
          pauseTogether();
          resetTogether();
        },
      };
    }

    function setupCarouselVideoPairs(carousel) {
      var pairControllers = Array.prototype.map.call(
        carousel.element.querySelectorAll('[data-video-pair]'),
        setupVideoPair
      );
      console.assert(pairControllers.length === carousel.state.length,
        'Every carousel slide must contain one video pair.');

      function activatePair(index) {
        pairControllers.forEach(function(controller, pairIndex) {
          if (pairIndex === index) controller.activate();
          else controller.deactivate();
        });
      }

      carousel.on('before:show', function() {
        pairControllers.forEach(function(controller) {
          controller.deactivate();
        });
      });
      carousel.on('after:show', function(state) {
        activatePair(parseInt(state.next, 10));
      });

      activatePair(carousel.state.index);
    }

    for (var i = 0; i < carousels.length; i++) {
      if (carousels[i].element.id === 'results-carousel') {
        setupCarouselVideoPairs(carousels[i]);
      }
    }
});
