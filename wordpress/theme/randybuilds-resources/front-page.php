<?php
// The resource center's home: the main site's /resources/ hub — search, topics,
// guides, good first stops, and the "more from this hub" cards.
if (!defined('ABSPATH')) exit;
get_header();
$total = (int) (new WP_Query(['post_type' => 'post', 'posts_per_page' => 1, 'fields' => 'ids', 'category__not_in' => array_filter([rbr_guides_term()?->term_id])]))->found_posts;
$guides_term = rbr_guides_term();
?>
<div class="page-head--color" data-color="sea">
  <div class="wrap page-head">
    <p class="kicker"><b>~/</b>resources</p>
    <h1>Resources</h1>
    <p class="lede">Free tools, official guidance and practical guides for running a small business and its website. Use them whether or not you ever hire me.</p>
    <?php get_search_form(['label' => sprintf('Search %d free resources', $total)]); ?>
    <ul class="res-facts-row" aria-label="About these resources">
      <li><span class="band-chip" data-color="sea" aria-hidden="true"></span>Every listing checked by hand</li>
      <li><span class="band-chip" data-color="cobalt" aria-hidden="true"></span>Each says what’s free and what isn’t</li>
      <li><span class="band-chip" data-color="orange" aria-hidden="true"></span>No sign-up needed here</li>
    </ul>
  </div>
</div>

<section class="section" id="topics" aria-labelledby="topics-title">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker"><b>01</b> browse by topic</p>
        <h2 id="topics-title">Browse by topic</h2>
      </div>
      <a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">See all <?php echo (int) $total; ?> resources</a>
    </div>
    <ul class="res-topics">
      <?php foreach (rbr_topics() as $t) : ?>
        <li class="res-topic" data-color="<?php echo esc_attr(rbr_color($t)); ?>">
          <a href="<?php echo esc_url(get_category_link($t)); ?>">
            <span class="res-topic__title"><span class="band-chip" aria-hidden="true"></span><?php echo esc_html($t->name); ?></span>
            <span class="res-topic__line"><?php echo esc_html($t->description); ?></span>
            <span class="res-topic__count"><?php echo (int) $t->count; ?> resources</span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </div>
</section>

<?php
$guides = $guides_term ? new WP_Query(['cat' => $guides_term->term_id, 'posts_per_page' => 12, 'no_found_rows' => true]) : null;
if ($guides && $guides->have_posts()) :
  // The featured guide goes first and large, the rest in date order.
  $posts = $guides->posts;
  usort($posts, fn($a, $b) => (int) (get_post_meta($b->ID, 'rbr_featured', true) === '1') <=> (int) (get_post_meta($a->ID, 'rbr_featured', true) === '1'));
?>
<section class="section section--fog" aria-labelledby="guides-title">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker"><b>02</b> guides</p>
        <h2 id="guides-title">Practical guides</h2>
        <p class="lede">Original, plain-language guides to common website and business tasks.</p>
      </div>
      <a class="textlink" href="<?php echo esc_url(get_category_link($guides_term)); ?>">All guides</a>
    </div>
    <ul class="guide-grid guide-grid--hub">
      <?php foreach ($posts as $i => $p) { setup_postdata($GLOBALS['post'] = $p); get_template_part('template-parts/card', 'guide', ['featured' => $i === 0]); } wp_reset_postdata(); ?>
    </ul>
  </div>
</section>
<?php endif; ?>

<?php $start = new WP_Query(['tag' => 'good-first-stop', 'posts_per_page' => 24, 'no_found_rows' => true]);
if ($start->have_posts()) : ?>
<section class="section" aria-labelledby="start-title">
  <div class="wrap">
    <div class="head">
      <div>
        <p class="kicker"><b>03</b> good first stops</p>
        <h2 id="start-title">Good places to start</h2>
        <p class="lede">A short selection from the directory, one or two per topic.</p>
      </div>
      <a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">Search the directory</a>
    </div>
    <ul class="res-grid">
      <?php while ($start->have_posts()) { $start->the_post(); get_template_part('template-parts/card', 'resource'); } wp_reset_postdata(); ?>
    </ul>
  </div>
</section>
<?php endif; ?>

<section class="section section--fog" aria-labelledby="more-title">
  <div class="wrap">
    <h2 id="more-title" class="visually-hidden">More from this hub</h2>
    <ul class="svc-blocks">
      <li class="svc-block" data-color="orange">
        <h3>Know a good free resource?</h3>
        <p>Suggest it for the directory, or tell me about a broken link or a detail that has changed. Every suggestion is reviewed by hand before anything is listed.</p>
        <a class="textlink" href="<?php echo esc_url(RBR_MAIN . '/resources/suggest/'); ?>">Suggest a resource</a>
      </li>
      <li class="svc-block" data-color="cobalt">
        <h3>Not sure what you need?</h3>
        <p>Answer four short questions and see a few ways a website or online tool could help. No sign-up.</p>
        <a class="textlink" href="<?php echo esc_url(RBR_MAIN . '/explore/'); ?>">Explore what’s possible</a>
      </li>
      <li class="svc-block" data-color="sea">
        <h3>Rather have it built?</h3>
        <p>I build business websites, custom applications and improvements to existing sites, with a written scope and a fixed price.</p>
        <a class="textlink" href="<?php echo esc_url(RBR_MAIN . '/services/'); ?>">See services</a>
      </li>
    </ul>
    <p class="note res-disclaimer"><?php echo esc_html(RBR_DISCLAIMER); ?></p>
  </div>
</section>
<?php get_footer();
