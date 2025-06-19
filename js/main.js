(function ($) {
    "use strict";

    // Back to top button functionality
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $(".back-to-top").fadeIn("slow");
        } else {
            $(".back-to-top").fadeOut("slow");
        }
    });

    $(".back-to-top").click(function (e) {
        e.preventDefault();
        $("html, body").animate(
            { scrollTop: 0 },
            1500,
            "easeInOutExpo"
        );
    });

    // Carousel Initialization (Make sure you have the correct HTML in place)
    $(document).ready(function() {
        $('#blog-carousel').carousel(); //Initiera karusellen
    });

})(jQuery);
