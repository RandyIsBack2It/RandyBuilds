<?php
// A topic (category), the Guides category, or a tag (type, cost, audience, "Good first stop").
if (!defined('ABSPATH')) exit;
get_header();
$term = get_queried_object();
$is_guides = is_category('guides');
$color = is_category() ? rbr_color($term) : 'cobalt';
$label = is_category() ? ($is_guides ? 'guides' : 'topic') : 'tag';
?>
<div class="page-head--color" data-color="<?php echo esc_attr($color); ?>">
  <div class="wrap page-head">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Resources</a></p>
    <p class="kicker"><b>~/</b>resources / <?php echo esc_html($label); ?></p>
    <h1><?php echo esc_html(single_term_title('', false)); ?></h1>
    <?php if ($term && $term->description) : ?><p class="lede"><?php echo esc_html($term->description); ?></p><?php endif; ?>
    <?php if (!$is_guides) : ?><p class="guide__meta"><?php echo esc_html(sprintf(_n('%d resource', '%d resources', (int) $wp_query->found_posts), (int) $wp_query->found_posts)); ?></p><?php endif; ?>
  </div>
</div>
<section class="section section--tight">
  <div class="wrap">
    <?php if (have_posts()) : ?>
      <ul class="<?php echo $is_guides ? 'guide-grid' : 'res-grid'; ?>">
        <?php while (have_posts()) { the_post(); get_template_part('template-parts/card', null, ['heading' => 'h2']); } ?>
      </ul>
      <?php the_posts_pagination(['mid_size' => 1]); ?>
    <?php else : ?>
      <div class="res-empty"><h2>Nothing here yet</h2><a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">See the directory</a></div>
    <?php endif; ?>

    <?php if (is_category() && !$is_guides) get_template_part('template-parts/topic', 'next', ['topic' => $term]); ?>

    <?php if (!$is_guides) : ?>
      <nav class="section--tight" aria-labelledby="topics-nav">
        <h2 id="topics-nav" class="kicker archive__others"><b>~/</b>other topics</h2>
        <ul class="tag-list">
          <?php foreach (rbr_topics() as $t) if (!is_category($t->term_id)) printf('<li><a href="%s">%s</a></li>', esc_url(get_category_link($t)), esc_html($t->name)); ?>
        </ul>
      </nav>
      <p class="note res-disclaimer"><?php echo esc_html(RBR_DISCLAIMER); ?></p>
    <?php endif; ?>
  </div>
</section>
<?php get_footer();
