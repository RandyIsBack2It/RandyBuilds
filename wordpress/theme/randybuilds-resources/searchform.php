<?php
// Search across every listing and guide (/?s=…).
if (!defined('ABSPATH')) exit;
$id = 'q-' . wp_unique_id();
?>
<form class="res-search" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
  <label for="<?php echo esc_attr($id); ?>"><?php echo esc_html($args['label'] ?? 'Search Resources'); ?></label>
  <div class="res-search__row">
    <input id="<?php echo esc_attr($id); ?>" name="s" type="search" maxlength="100" autocomplete="off" spellcheck="false" value="<?php echo esc_attr(get_search_query()); ?>" placeholder="Try “business plan”, “booking” or “accessibility”">
    <button class="btn btn--orange" type="submit">Search</button>
  </div>
</form>
