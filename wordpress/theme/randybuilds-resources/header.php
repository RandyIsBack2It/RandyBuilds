<?php if (!defined('ABSPATH')) exit; ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="wordmark" href="<?php echo esc_url(RBR_MAIN . '/'); ?>" aria-label="RandyBuilds.tech, home">
      <svg class="wordmark__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="30" height="30" rx="7" fill="#0e1d2e" stroke="#24405c" stroke-width="2" />
        <path d="M8.5 10.5l6 5.5-6 5.5" fill="none" stroke="#6ea0ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="16.5" y="19.5" width="8" height="2.6" rx="1" fill="#f25c1f" />
      </svg>
      <span class="wordmark__text" aria-hidden="true"><b>Randy</b>Builds<span class="wordmark__dot">.</span><span class="wordmark__tld">tech</span></span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="site-nav-list">
        <span class="site-nav__bars" aria-hidden="true"></span>
        Menu
      </button>
      <ul id="site-nav-list" class="site-nav__list">
        <?php
        // The main site's header nav (src/site.ts `nav`); Resources is this site.
        $nav = [['Services', RBR_MAIN . '/services/'], ['Work', RBR_MAIN . '/work/'], ['Resources', home_url('/')], ['About', RBR_MAIN . '/#about'], ['FAQ', RBR_MAIN . '/#faq']];
        foreach ($nav as $i => [$label, $url]) {
          printf('<li><a href="%s"%s><span class="n" aria-hidden="true">%02d</span>%s</a></li>', esc_url($url), $label === 'Resources' ? ' aria-current="page"' : '', $i + 1, esc_html($label));
        }
        ?>
        <li class="site-nav__cta"><a class="btn btn--small btn--orange" href="<?php echo esc_url(RBR_MAIN . '/#contact'); ?>">Start a project</a></li>
        <li class="site-nav__admin">
          <!-- Admin sign-in (assets/js/admin-key.js, copied from the main site), at the bottom of the phone menu drawer (Randy, 2026-10-27; wide screens use the footer’s, footer.php): the >_ mark opens a prompt in place, like the hero’s (“who are you?”), and the key is
               typed where the cursor was. The gate checks it server-side (POST /api/admin/login). Without JavaScript there is no drawer,
               so it stays hidden; /admin/ still signs in. -->
          <div class="admin-key">
            <a class="admin-key__mark admin-key__link" href="<?php echo esc_url(RBR_MAIN . '/admin/'); ?>" rel="nofollow" aria-label="Admin sign-in">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path class="admin-key__under" d="M9 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
            </a>
            <form class="admin-key__form" method="post" action="/api/admin/login" hidden>
              <button class="admin-key__mark" type="button" aria-label="Admin sign-in" aria-expanded="false" aria-controls="admin-key-menu">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path class="admin-key__under" d="M9 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
              </button>
              <span class="admin-key__cmd" aria-hidden="true">who are you?&nbsp;</span>
              <label class="visually-hidden" for="admin-key-menu">Who are you? (admin key)</label>
              <input class="admin-key__field" id="admin-key-menu" name="code" type="password" maxlength="64"
                autocomplete="current-password" spellcheck="false" tabindex="-1" />
              <p class="visually-hidden" role="status" data-admin-status></p>
            </form>
          </div>
        </li>
      </ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
