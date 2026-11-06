<?php
// After a topic's listings: a guide from this site that fits the topic, and the main site's
// related service (functions.php RBR_TOPIC_NEXT). Once per page, never on the cards.
if (!defined('ABSPATH')) exit;
$next = rbr_topic_next($args['topic'] ?? null);
if (!$next['guide'] && !$next['service']) return;
$g = $next['guide'];
$s = $next['service'];
?>
<section class="res-next" aria-labelledby="next-title">
  <h2 id="next-title" class="visually-hidden">Next steps</h2>
  <ul class="svc-blocks">
    <?php if ($g) : ?>
      <li class="svc-block" data-color="sea">
        <h3>Do it yourself</h3>
        <p><strong><?php echo esc_html(get_the_title($g)); ?>.</strong> <?php echo esc_html(rbr_meta('rbr_summary', $g) ?: get_the_excerpt($g)); ?></p>
        <a class="textlink" href="<?php echo esc_url(get_permalink($g)); ?>">Read the guide<span class="visually-hidden">: <?php echo esc_html(get_the_title($g)); ?></span></a>
      </li>
    <?php endif; ?>
    <?php if ($s) : ?>
      <li class="svc-block" data-color="cobalt">
        <h3><?php echo esc_html($s[0]); ?></h3>
        <p><?php echo esc_html($s[1]); ?></p>
        <a class="textlink" href="<?php echo esc_url(RBR_MAIN . $s[2]); ?>"><?php echo esc_html($s[3]); ?></a>
      </li>
    <?php endif; ?>
  </ul>
</section>
