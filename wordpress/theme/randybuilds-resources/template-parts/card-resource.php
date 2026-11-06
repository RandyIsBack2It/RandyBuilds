<?php
// One listing as a card (directory, topics, tags, search, the hub and under guides).
// Same parts as the main site's ResourceCard: topic, type, name, publisher,
// description, "Good for", cost, and a link to the publisher.
if (!defined('ABSPATH')) exit;
$h = $args['heading'] ?? 'h3';
$topic = rbr_topic();
$url = rbr_meta('rbr_url');
$price = rbr_meta('rbr_price');
$note = rbr_meta('rbr_price_note');
$good = rbr_meta('rbr_good_for');
$type = rbr_meta('rbr_type');
?>
<li class="res" data-color="<?php echo esc_attr(rbr_color($topic)); ?>">
  <p class="res__meta">
    <?php if ($topic) : ?><a href="<?php echo esc_url(get_category_link($topic)); ?>"><?php echo esc_html($topic->name); ?></a><?php endif; ?>
    <?php if ($type) : ?><span class="res__type"><?php echo esc_html($type); ?></span><?php endif; ?>
  </p>
  <<?php echo $h; ?> class="res__name"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></<?php echo $h; ?>>
  <?php if ($pub = rbr_meta('rbr_publisher')) : ?><p class="res__pub"><?php echo esc_html($pub); ?></p><?php endif; ?>
  <?php if ($url) : ?><p class="res__url"><?php echo esc_html(rbr_display_url($url)); ?></p><?php endif; ?>
  <p class="res__desc"><?php echo esc_html(get_the_excerpt()); ?></p>
  <?php if ($good) : ?><p class="res__for"><span>Good for</span> <?php echo esc_html($good); ?></p><?php endif; ?>
  <?php if ($price) : ?>
    <p class="res__cost"><span class="res__price" data-price="<?php echo esc_attr($price); ?>"><?php echo esc_html(rbr_price_label($price)); ?></span><?php echo esc_html($note); ?></p>
  <?php endif; ?>
  <div class="res__actions">
    <?php if ($url) : ?>
      <a class="res__visit" href="<?php echo esc_url($url); ?>" rel="noopener noreferrer external">Visit site<?php echo rbr_external_icon(); ?><span class="visually-hidden"> (external site): <?php the_title(); ?></span></a>
    <?php endif; ?>
    <a class="res__more" href="<?php the_permalink(); ?>">Details<span class="visually-hidden">: <?php the_title(); ?></span></a>
  </div>
</li>
