<?php
// Search results across guides and listings (/?s=…).
if (!defined('ABSPATH')) exit;
get_header();
$n = (int) $wp_query->found_posts;
?>
<div class="page-head--color" data-color="cobalt">
  <div class="wrap page-head">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Resources</a></p>
    <p class="kicker"><b>~/</b>resources / search</p>
    <h1><?php echo get_search_query() !== '' ? esc_html(sprintf('Results for “%s”', get_search_query())) : 'Search'; ?></h1>
    <?php get_search_form(); ?>
    <p class="guide__meta" role="status"><?php echo esc_html(sprintf(_n('%d result', '%d results', $n), $n)); ?></p>
  </div>
</div>
<section class="section section--tight">
  <div class="wrap">
    <?php if (have_posts()) : ?>
      <ul class="res-grid">
        <?php while (have_posts()) { the_post(); get_template_part('template-parts/card', null, ['heading' => 'h2']); } ?>
      </ul>
      <?php the_posts_pagination(['mid_size' => 1]); ?>
    <?php else : ?>
      <div class="res-empty">
        <h2>Nothing matches</h2>
        <p>Try fewer or different words, or browse by topic.</p>
        <a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">See the directory</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php get_footer();
