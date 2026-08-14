jQuery(function ($) {
  if (!window.gsap) {
    return;
  }

  const $body = $("body");
  const $ball = $("#ball");
  const $magicCursor = $("#magic-cursor");

  if (
    !$ball.length ||
    !$magicCursor.length ||
    $body.hasClass("is-mobile") ||
    !$body.hasClass("tw-magic-cursor")
  ) {
    return;
  }

  const mouse = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  const ratio = 0.15;
  const ballWidth = 5;
  const ballHeight = 5;
  const ballScale = 1;
  const ballOpacity = 1;
  const ballBorderWidth = 1;

  gsap.set($ball, {
    xPercent: -50,
    yPercent: -50,
    width: ballWidth,
    height: ballHeight,
    borderWidth: ballBorderWidth,
    opacity: ballOpacity,
  });

  const showMagicCursor = () => {
    gsap.to($magicCursor, {
      duration: 0.3,
      autoAlpha: 1,
      overwrite: true,
    });
  };

  const hideMagicCursor = () => {
    gsap.to($magicCursor, {
      duration: 0.3,
      autoAlpha: 0,
      overwrite: true,
    });
  };

  document.addEventListener("mousemove", function (event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  gsap.ticker.add(function () {
    pos.x += (mouse.x - pos.x) * ratio;
    pos.y += (mouse.y - pos.y) * ratio;
    gsap.set($ball, {
      x: pos.x,
      y: pos.y,
    });
  });

  $("a, button, .tw-cart-minus, .tw-cart-plus")
    .not(".cursor-hide")
    .on("mouseenter", function () {
      gsap.to($ball, {
        duration: 0.3,
        scale: 0,
        opacity: 0,
        overwrite: true,
      });
    })
    .on("mouseleave", function () {
      gsap.to($ball, {
        duration: 0.3,
        scale: ballScale,
        opacity: ballOpacity,
        overwrite: true,
      });
    });

  $("a")
    .not('[target="_blank"]')
    .not(".cursor-hide")
    .not('[href^="#"]')
    .not('[href^="mailto"]')
    .not('[href^="tel"]')
    .not(".lg-trigger")
    .not(".tw-btn-disabled a")
    .on("click", function () {
      gsap.to($ball, {
        duration: 0.3,
        scale: 1.3,
        autoAlpha: 0,
        overwrite: true,
      });
    });

  $(document)
    .on("mouseleave", hideMagicCursor)
    .on("mouseenter", showMagicCursor)
    .on("mousemove", showMagicCursor);

  $("[data-cursor]").each(function () {
    const $item = $(this);
    const $view = $("<div class='ball-view' aria-hidden='true'></div>");

    $item.on("mouseenter", function () {
      const text = String($item.attr("data-cursor") || "").trim();
      $ball.addClass("with-blur");

      if (!$ball.find(".ball-view").length) {
        $ball.append($view);
      }

      $view.text(text);
      gsap.to($ball, {
        duration: 0.3,
        yPercent: -75,
        width: 140,
        height: 140,
        opacity: 1,
        borderWidth: 1,
        zIndex: 1,
        backdropFilter: "blur(14px)",
        backgroundColor: "#ff6644",
        boxShadow: "0px 1px 3px 0px rgba(18, 20, 32, 0.14)",
        overwrite: true,
      });
      gsap.to($view, {
        duration: 0.3,
        scale: 1,
        autoAlpha: 1,
        overwrite: true,
      });
    });

    $item.on("mouseleave", function () {
      $ball.removeClass("with-blur");
      gsap.to($ball, {
        duration: 0.3,
        yPercent: -50,
        width: ballWidth,
        height: ballHeight,
        opacity: ballOpacity,
        borderWidth: ballBorderWidth,
        backgroundColor: "#1c1d21",
        boxShadow: "none",
        overwrite: true,
      });
      gsap.to($view, {
        duration: 0.3,
        scale: 0,
        autoAlpha: 0,
        clearProps: "all",
        overwrite: true,
      });
      $ball.find(".ball-view").remove();
    });

    $item.addClass("not-hide-cursor");
  });
});
