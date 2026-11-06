<?php
/**
 * Site settings for the resource center. Run by `rbr.sh setup` (wp eval-file).
 * Safe to run again: every step checks before it changes anything.
 */

if (!defined('ABSPATH')) exit;

// ── General ────────────────────────────────────────────────────────────
$options = [
  'blogname'                     => 'RandyBuilds.tech Resources',
  'blogdescription'              => 'Free tools, official guidance and practical guides for running a small business and its website.',
  'timezone_string'              => 'America/New_York',
  'date_format'                  => 'M j, Y',
  'start_of_week'                => 0,
  'permalink_structure'          => '/%postname%/',
  'category_base'                => 'topic',
  'tag_base'                     => 'tag',
  'posts_per_page'               => 24,
  'blog_public'                  => 1,
  // No comments, pingbacks or registrations: nothing is published without Randy.
  'default_comment_status'       => 'closed',
  'default_ping_status'          => 'closed',
  'default_pingback_flag'        => 0,
  'comment_registration'         => 1,
  'comment_moderation'           => 1,
  'users_can_register'           => 0,
  'default_role'                 => 'subscriber',
  'uploads_use_yearmonth_folders' => 1,
];
foreach ($options as $k => $v) update_option($k, $v);

// ── Theme ──────────────────────────────────────────────────────────────
if (get_stylesheet() !== 'randybuilds-resources') switch_theme('randybuilds-resources');

// ── Remove the install's sample content (never published here) ─────────
foreach (['hello-world' => 'post', 'sample-page' => 'page'] as $slug => $type) {
  $p = get_page_by_path($slug, OBJECT, $type);
  if ($p) wp_delete_post($p->ID, true);
}
foreach (get_comments(['status' => 'all']) as $c) wp_delete_comment($c->comment_ID, true);
// The draft privacy page WordPress creates stays a draft; the site links to the main site's Privacy page.

// Bundled plugins that aren't used (none is needed: see README.md, "Plugins").
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
foreach (['hello.php', 'akismet/akismet.php'] as $plugin) {
  if (file_exists(WP_PLUGIN_DIR . '/' . $plugin)) delete_plugins([$plugin]);
}

// Keep one default theme as a fallback; remove the older ones.
require_once ABSPATH . 'wp-admin/includes/theme.php';
foreach (['twentytwentythree', 'twentytwentyfour'] as $old) {
  if (wp_get_theme($old)->exists()) delete_theme($old);
}

// ── Pages: Home (front page) and Directory (all listings) ──────────────
function rbr_page(string $slug, string $title, string $excerpt = ''): int {
  $p = get_page_by_path($slug, OBJECT, 'page');
  if ($p) return $p->ID;
  return (int) wp_insert_post([
    'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug,
    'post_title' => $title, 'post_excerpt' => $excerpt, 'post_content' => '', 'comment_status' => 'closed',
  ]);
}
$home = rbr_page('home', 'Resources');
$directory = rbr_page('directory', 'Resource directory');
update_option('show_on_front', 'page');
update_option('page_on_front', $home);
update_option('page_for_posts', $directory);

// ── Admin profile ──────────────────────────────────────────────────────
$admin = get_user_by('login', 'randy');
if ($admin) wp_update_user(['ID' => $admin->ID, 'display_name' => 'Randy', 'nickname' => 'Randy', 'first_name' => 'Randy']);

WP_CLI::success('settings applied');
