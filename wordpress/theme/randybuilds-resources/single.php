<?php
// One post: a guide (Guides category) or a listing.
if (!defined('ABSPATH')) exit;
get_header();
while (have_posts()) : the_post();
  $guide = rbr_is_guide();
  $topic = rbr_topic();
  $checklist = rbr_meta('rbr_checklist') === '1';
  $toc = $guide ? rbr_toc() : [];
  $modified = get_the_modified_date('Y-m-d') !== get_the_date('Y-m-d');
?>
<article <?php post_class(); ?>>
  <div class="page-head--color" data-color="<?php echo esc_attr($guide ? 'sea' : rbr_color($topic)); ?>">
    <header class="wrap page-head">
      <?php if ($topic) : ?><p class="crumb"><a href="<?php echo esc_url(get_category_link($topic)); ?>"><?php echo esc_html($topic->name); ?></a></p><?php endif; ?>
      <p class="kicker"><b>~/</b>resources / <?php echo esc_html($guide ? ($checklist ? 'checklist' : 'guide') : strtolower(rbr_meta('rbr_type') ?: 'resource')); ?></p>
      <h1><?php the_title(); ?></h1>
      <?php if (!$guide && ($url = rbr_meta('rbr_url'))) : ?>
        <p class="listing__url"><a href="<?php echo esc_url($url); ?>" rel="noopener noreferrer external"><?php echo esc_html(rbr_display_url($url)); ?><?php echo rbr_external_icon(); ?><span class="visually-hidden"> (external site)</span></a></p>
      <?php endif; ?>
      <?php if ($guide && has_excerpt()) : ?><p class="lede"><?php echo esc_html(get_the_excerpt()); ?></p><?php endif; ?>
      <?php if ($guide) : ?>
        <p class="guide__meta">RandyBuilds.tech · <time datetime="<?php echo esc_attr(get_the_modified_date('Y-m-d')); ?>"><?php echo $modified ? 'Updated ' : ''; echo esc_html(get_the_modified_date('F j, Y')); ?></time> · <?php echo (int) rbr_minutes(); ?> min read</p>
      <?php elseif ($pub = rbr_meta('rbr_publisher')) : ?>
        <p class="lede"><?php echo esc_html($pub); ?></p>
      <?php endif; ?>
    </header>
  </div>

  <div class="section section--tight">
    <div class="wrap guide__layout<?php echo count($toc) > 2 ? ' guide__layout--toc' : ''; ?><?php echo $guide ? '' : ' listing__layout'; ?>">
      <?php if (count($toc) > 2) : ?>
        <nav class="guide__toc" aria-label="On this page">
          <p class="guide__toc-title">On this page</p>
          <ol><?php foreach ($toc as $h) printf('<li><a href="#%s">%s</a></li>', esc_attr($h['id']), esc_html($h['text'])); ?></ol>
        </nav>
      <?php endif; ?>
      <div class="prose<?php echo $checklist ? ' is-checklist' : ''; ?>">
        <?php the_content(); ?>
      </div>
      <?php if (!$guide) :
        $tags = get_the_tags(); ?>
        <aside class="listing__side" aria-label="About this listing">
          <?php if ($tags) : ?>
            <ul class="tag-list"><?php foreach ($tags as $t) printf('<li><a href="%s" rel="tag">%s</a></li>', esc_url(get_tag_link($t)), esc_html($t->name)); ?></ul>
          <?php endif; ?>
          <p class="note"><?php echo esc_html(RBR_DISCLAIMER); ?></p>
          <p class="listing__report"><a href="<?php echo esc_url(RBR_MAIN . '/resources/suggest/?report=' . rawurlencode(get_post_field('post_name'))); ?>">Report a problem<span class="visually-hidden"> with this listing: <?php the_title(); ?></span></a></p>
        </aside>
      <?php endif; ?>
    </div>
  </div>
</article>

<?php
if ($guide) :
  $related = rbr_related();
  if ($related) : ?>
  <section class="section section--fog" aria-labelledby="related-title">
    <div class="wrap">
      <div class="head">
        <div>
          <p class="kicker"><b>~/</b>resources / related</p>
          <h2 id="related-title">Free resources for this</h2>
          <p class="lede">From the directory. Each link goes to the original publisher.</p>
        </div>
        <a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">Search all resources</a>
      </div>
      <ul class="res-grid">
        <?php foreach ($related as $p) { setup_postdata($GLOBALS['post'] = $p); get_template_part('template-parts/card', 'resource'); } wp_reset_postdata(); ?>
      </ul>
    </div>
  </section>
  <?php endif;
  // Guide order is by date, newest first, so the "previous" guide is the newer one.
  $prev = get_adjacent_post(true, '', false);
  $next = get_adjacent_post(true, '', true); ?>
  <nav class="section section--tight" aria-label="More guides">
    <div class="wrap guide-pager__inner">
      <?php if ($prev) : ?><a class="guide-pager__link" href="<?php echo esc_url(get_permalink($prev)); ?>" rel="prev"><span>Previous guide</span><?php echo esc_html(get_the_title($prev)); ?></a><?php else : ?><span></span><?php endif; ?>
      <?php if ($next) : ?><a class="guide-pager__link guide-pager__link--next" href="<?php echo esc_url(get_permalink($next)); ?>" rel="next"><span>Next guide</span><?php echo esc_html(get_the_title($next)); ?></a>
      <?php else : ?><a class="guide-pager__link guide-pager__link--next" href="<?php echo esc_url(home_url('/')); ?>"><span>Back to</span>Resources</a><?php endif; ?>
    </div>
    <?php if ($help = rbr_meta('rbr_help')) : ?><p class="wrap guide-pager__help"><?php echo wp_kses($help, ['a' => ['href' => []]]); ?></p><?php endif; ?>
  </nav>
<?php else :
  // A few more listings from the same topic.
  $more_q = $topic ? new WP_Query(['cat' => $topic->term_id, 'post__not_in' => [get_the_ID()], 'posts_per_page' => 3, 'no_found_rows' => true]) : null;
  if ($more_q && $more_q->have_posts()) : ?>
  <section class="section section--fog" aria-labelledby="more-title">
    <div class="wrap">
      <div class="head">
        <div>
          <p class="kicker"><b>~/</b>resources / <?php echo esc_html(strtolower($topic->name)); ?></p>
          <h2 id="more-title">More in <?php echo esc_html($topic->name); ?></h2>
        </div>
        <a class="textlink" href="<?php echo esc_url(get_category_link($topic)); ?>">See all <?php echo (int) $topic->count; ?></a>
      </div>
      <ul class="res-grid">
        <?php while ($more_q->have_posts()) { $more_q->the_post(); get_template_part('template-parts/card', 'resource'); } wp_reset_postdata(); ?>
      </ul>
    </div>
  </section>
  <?php endif;
endif;
endwhile;
get_footer();
