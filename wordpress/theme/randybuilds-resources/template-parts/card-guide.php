<?php
// One guide as a card. The whole card is one link.
if (!defined('ABSPATH')) exit;
$h = $args['heading'] ?? 'h3';
$featured = !empty($args['featured']);
$checklist = rbr_meta('rbr_checklist') === '1';
$summary = $featured ? get_the_excerpt() : (rbr_meta('rbr_summary') ?: get_the_excerpt());
?>
<li class="guide-card<?php echo $featured ? ' guide-card--featured' : ''; ?>">
  <p class="guide-card__meta"><?php echo $checklist ? 'Checklist' : 'Guide'; ?> · <?php echo (int) rbr_minutes(); ?> min read</p>
  <<?php echo $h; ?> class="guide-card__title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></<?php echo $h; ?>>
  <p class="guide-card__summary"><?php echo esc_html($summary); ?></p>
  <span class="guide-card__go" aria-hidden="true">Read the <?php echo $checklist ? 'checklist' : 'guide'; ?></span>
</li>
