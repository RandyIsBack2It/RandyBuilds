<?php
// Fallback for any view without its own template.
if (!defined('ABSPATH')) exit;
get_header(); ?>
<div class="page-head--color" data-color="cobalt">
  <div class="wrap page-head">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Resources</a></p>
    <h1><?php echo esc_html(wp_get_document_title()); ?></h1>
  </div>
</div>
<section class="section section--tight">
  <div class="wrap">
    <?php if (have_posts()) : ?>
      <ul class="res-grid"><?php while (have_posts()) { the_post(); get_template_part('template-parts/card', null, ['heading' => 'h2']); } ?></ul>
      <?php the_posts_pagination(['mid_size' => 1]); ?>
    <?php else : ?>
      <p>Nothing here yet.</p>
    <?php endif; ?>
  </div>
</section>
<?php get_footer();
