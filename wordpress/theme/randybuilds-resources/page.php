<?php
// A plain page.
if (!defined('ABSPATH')) exit;
get_header();
while (have_posts()) : the_post(); ?>
<article>
  <div class="page-head--color" data-color="cobalt">
    <header class="wrap page-head">
      <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Resources</a></p>
      <h1><?php the_title(); ?></h1>
      <?php if (has_excerpt()) : ?><p class="lede"><?php echo esc_html(get_the_excerpt()); ?></p><?php endif; ?>
    </header>
  </div>
  <div class="section section--tight">
    <div class="wrap"><div class="prose"><?php the_content(); ?></div></div>
  </div>
</article>
<?php endwhile;
get_footer();
