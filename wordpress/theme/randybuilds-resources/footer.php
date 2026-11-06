<?php if (!defined('ABSPATH')) exit;
$since = 2026;
$year = (int) wp_date('Y');
$years = $year > $since ? "$since–$year" : (string) $year;
$guides = rbr_guides_term();
?>
</main>
<section class="section cta" aria-labelledby="cta-title">
  <div class="wrap cta__inner">
    <div>
      <h2 id="cta-title">Let’s talk about your project.</h2>
      <p>Free project review by email, with no obligation and no meeting required. I aim to reply within three business days.</p>
    </div>
    <a class="btn" href="<?php echo esc_url(RBR_MAIN . '/#contact'); ?>">Start a project</a>
  </div>
</section>
<footer class="site-footer">
  <div class="bands" aria-hidden="true"></div>
  <div class="wrap site-footer__grid">
    <div class="site-footer__brand">
      <a class="wordmark" href="<?php echo esc_url(RBR_MAIN . '/'); ?>" aria-label="RandyBuilds.tech, main site">
        <svg class="wordmark__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect x="1" y="1" width="30" height="30" rx="7" fill="#0e1d2e" stroke="#24405c" stroke-width="2" />
          <path d="M8.5 10.5l6 5.5-6 5.5" fill="none" stroke="#6ea0ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="16.5" y="19.5" width="8" height="2.6" rx="1" fill="#f25c1f" />
        </svg>
        <span class="wordmark__text" aria-hidden="true"><b>Randy</b>Builds<span class="wordmark__dot">.</span><span class="wordmark__tld">tech</span></span>
      </a>
      <p>Business websites, custom applications and website improvements, built by one independent developer.</p>
      <p>Maine-based and neurodivergent-owned. Available for projects across New England and remotely.</p>
    </div>
    <nav aria-labelledby="footer-resources">
      <h2 id="footer-resources">Resources</h2>
      <ul>
        <li><a href="<?php echo esc_url(home_url('/')); ?>">All resources</a></li>
        <li><a href="<?php echo esc_url(home_url('/directory/')); ?>">Directory</a></li>
        <?php if ($guides) : ?><li><a href="<?php echo esc_url(get_term_link($guides)); ?>">Guides</a></li><?php endif; ?>
        <li><a href="<?php echo esc_url(home_url('/#topics')); ?>">Topics</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/resources/suggest/'); ?>">Suggest a resource</a></li>
      </ul>
    </nav>
    <nav aria-labelledby="footer-site">
      <h2 id="footer-site">RandyBuilds.tech</h2>
      <ul>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/services/'); ?>">Services</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/work/'); ?>">Work</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/explore/'); ?>">Explore ideas</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/#about'); ?>">About</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/#faq'); ?>">FAQ</a></li>
      </ul>
    </nav>
    <div class="site-footer__contact">
      <h2>Get in touch</h2>
      <a class="email" href="mailto:connect@randybuilds.tech?subject=Project%20inquiry">connect@randybuilds.tech</a>
      <p><a href="<?php echo esc_url(RBR_MAIN . '/#contact'); ?>">Start a project</a></p>
    </div>
  </div>
  <div class="wrap">
    <div class="site-footer__legal">
      <div class="site-footer__copy">
        <p>© <?php echo esc_html($years); ?> RandyBuilds.tech</p>
        <!-- Admin sign-in (assets/js/admin-key.js, copied from the main site), after the copyright on wide screens (phones and tablets use the menu drawer’s, header.php): the >_ mark opens a prompt in place, like the hero’s (“who are you?”), and the key is
             typed where the cursor was. The gate checks it server-side (POST /api/admin/login). Without JavaScript the
             mark links to the /admin/ sign-in page. -->
        <div class="admin-key">
          <a class="admin-key__mark admin-key__link" href="<?php echo esc_url(RBR_MAIN . '/admin/'); ?>" rel="nofollow" aria-label="Admin sign-in">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path class="admin-key__under" d="M9 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </a>
          <form class="admin-key__form" method="post" action="/api/admin/login" hidden>
            <button class="admin-key__mark" type="button" aria-label="Admin sign-in" aria-expanded="false" aria-controls="admin-key">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /><path class="admin-key__under" d="M9 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
            </button>
            <span class="admin-key__cmd" aria-hidden="true">who are you?&nbsp;</span>
            <label class="visually-hidden" for="admin-key">Who are you? (admin key)</label>
            <input class="admin-key__field" id="admin-key" name="code" type="password" maxlength="64"
              autocomplete="current-password" spellcheck="false" tabindex="-1" />
            <p class="visually-hidden" role="status" data-admin-status></p>
          </form>
        </div>
      </div>
      <ul>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/privacy/'); ?>">Privacy</a></li>
        <li><a href="<?php echo esc_url(RBR_MAIN . '/terms/'); ?>">Terms</a></li>
      </ul>
    </div>
  </div>
  <!-- Back to top (assets/js/to-top.js, as on the main site): fixed bottom right; inside the footer so it sits in a landmark. -->
  <a class="totop" href="#main" aria-label="Back to top">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 10l4.5-4.5 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <span class="totop__label" aria-hidden="true">top</span>
  </a>
</footer>
<?php wp_footer(); ?>
</body>
</html>
