<?php
if (!defined('ABSPATH')) exit;
get_header(); ?>
<div class="page-head--color" data-color="orange">
  <div class="wrap page-head">
    <p class="kicker"><b>404</b> not found</p>
    <h1>This page isn’t here</h1>
    <p class="lede">It may have moved. Search Resources, or start from the directory.</p>
    <?php get_search_form(); ?>
    <p><a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">See the directory</a></p>
  </div>
</div>
<?php get_footer();
