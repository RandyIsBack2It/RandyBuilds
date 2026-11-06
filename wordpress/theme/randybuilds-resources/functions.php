<?php
/**
 * RandyBuilds.tech Resources — a small classic theme in the main site's
 * "terminal blueprint" style. No build step, no dependencies, no plugins needed.
 *
 * Content model (see wordpress/README.md):
 * - Posts in the Guides category are guides; every other post is a listing.
 * - Categories are topics (term meta rbr_color, rbr_order). Tags are type,
 *   cost, audience and "Good first stop" (term meta rbr_group).
 * - Listing details live in post meta (rbr_publisher, rbr_url, …) for the cards,
 *   and in the post content for the listing's own page.
 */

if (!defined('ABSPATH')) exit;

const RBR_MAIN = 'https://randybuilds.tech';
const RBR_DISCLAIMER = 'Listings are not endorsements or partnerships, and no one pays to be included. Each publisher sets its own terms, prices and privacy rules, and they change, so check the publisher’s page before you rely on a detail.';

// ── Setup ──────────────────────────────────────────────────────────────
add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script', 'navigation-widgets']);
  add_theme_support('responsive-embeds');
  add_theme_support('align-wide');
  add_theme_support('post-thumbnails');
  add_theme_support('editor-styles');
  add_editor_style('assets/editor.css');
  remove_theme_support('core-block-patterns');
});

add_action('init', function () {
  register_block_style('core/list', ['name' => 'checklist', 'label' => 'Checklist']);
  // Custom fields shown in the editor's "Custom fields" panel (Preferences → Panels).
  add_post_type_support('post', 'custom-fields');
  foreach (['rbr_kind', 'rbr_publisher', 'rbr_url', 'rbr_host', 'rbr_good_for', 'rbr_type', 'rbr_price', 'rbr_price_note', 'rbr_account',
            'rbr_checked', 'rbr_keywords', 'rbr_summary', 'rbr_featured', 'rbr_checklist', 'rbr_related', 'rbr_help', 'rbr_source'] as $key) {
    register_post_meta('post', $key, ['type' => 'string', 'single' => true, 'show_in_rest' => true,
      'auth_callback' => fn() => current_user_can('edit_posts')]);
  }
  // No comments anywhere: there is nothing to moderate.
  remove_post_type_support('post', 'comments');
  remove_post_type_support('post', 'trackbacks');
  remove_post_type_support('page', 'comments');
});

add_action('wp_enqueue_scripts', function () {
  $dir = get_template_directory();
  wp_enqueue_style('rbr', get_stylesheet_uri(), [], (string) filemtime($dir . '/style.css'));
  wp_enqueue_script('rbr-nav', get_template_directory_uri() . '/assets/js/nav.js', [], (string) filemtime($dir . '/assets/js/nav.js'), ['strategy' => 'defer', 'in_footer' => true]);
  wp_enqueue_script('rbr-totop', get_template_directory_uri() . '/assets/js/to-top.js', [], (string) filemtime($dir . '/assets/js/to-top.js'), ['strategy' => 'defer', 'in_footer' => true]);
  wp_enqueue_script('rbr-admin-key', get_template_directory_uri() . '/assets/js/admin-key.js', [], (string) filemtime($dir . '/assets/js/admin-key.js'), ['strategy' => 'defer', 'in_footer' => true]);
  // No block library CSS for blocks this theme styles itself.
  wp_dequeue_style('classic-theme-styles');
});

// ── Head: lean and quiet ───────────────────────────────────────────────
remove_action('wp_head', 'wp_generator');
remove_action('wp_head', 'rsd_link');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'wp_shortlink_wp_head');
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('admin_print_scripts', 'print_emoji_detection_script');
remove_action('admin_print_styles', 'print_emoji_styles');
add_filter('emoji_svg_url', '__return_false');
add_filter('the_generator', '__return_empty_string');

add_action('wp_head', function () {
  $uri = get_template_directory_uri();
  printf('<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n", esc_url($uri . '/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2'));
  printf('<link rel="icon" href="%s" type="image/svg+xml">' . "\n", esc_url($uri . '/assets/favicon.svg'));
  printf('<link rel="icon" href="%s" sizes="32x32" type="image/png">' . "\n", esc_url($uri . '/assets/favicon-32.png'));
  printf('<link rel="apple-touch-icon" href="%s">' . "\n", esc_url($uri . '/assets/apple-touch-icon.png'));
  echo '<meta name="theme-color" content="#07111c">' . "\n";

  $desc = rbr_description();
  $title = wp_get_document_title();
  $url = is_singular() ? get_permalink() : rbr_canonical();
  // Core prints rel=canonical only on single posts and pages; lists get theirs here.
  // Filtered directory views are noindex (wp_robots below), so they get none.
  if (!is_singular() && $url && !rbr_is_filtered()) printf('<link rel="canonical" href="%s">' . "\n", esc_url($url));
  if ($desc) printf('<meta name="description" content="%s">' . "\n", esc_attr($desc));
  printf('<meta property="og:site_name" content="%s">' . "\n", esc_attr(get_bloginfo('name')));
  printf('<meta property="og:title" content="%s">' . "\n", esc_attr($title));
  if ($desc) printf('<meta property="og:description" content="%s">' . "\n", esc_attr($desc));
  if ($url) printf('<meta property="og:url" content="%s">' . "\n", esc_url($url));
  printf('<meta property="og:type" content="%s">' . "\n", is_singular('post') ? 'article' : 'website');
  printf('<meta property="og:image" content="%s">' . "\n", esc_url(RBR_MAIN . '/og.png'));
  echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
  foreach (rbr_schema() as $s) echo '<script type="application/ld+json">' . wp_json_encode($s, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "</script>\n";
}, 2);

// Search results, 404s and filtered directory views (?topic=…, ?q=…) stay out of the index;
// their links are still followed. The unfiltered directory and topic pages are the indexed versions.
add_filter('wp_robots', function (array $robots) {
  if (is_search() || is_404() || rbr_is_filtered()) { $robots['noindex'] = true; $robots['follow'] = true; }
  return $robots;
});

/** The directory with any filter or search applied. */
function rbr_is_filtered(): bool {
  if (!is_home()) return false;
  foreach (['q', 'topic', 'type', 'cost', 'audience'] as $k) if (isset($_GET[$k]) && trim((string) $_GET[$k]) !== '') return true;
  return false;
}

/** The clean address of a list page (directory, topic, tag), without query strings. */
function rbr_canonical(): string {
  if (is_front_page()) return home_url('/');
  if (is_home()) return get_permalink((int) get_option('page_for_posts')) ?: home_url('/directory/');
  if (!is_category() && !is_tag()) return '';
  $link = get_term_link(get_queried_object());
  if (is_wp_error($link)) return '';
  $paged = (int) get_query_var('paged');
  return $paged > 1 ? trailingslashit($link) . 'page/' . $paged . '/' : $link;
}

/**
 * Structured data (schema.org), describing only what the page shows: breadcrumbs, a list of
 * listings on the directory and topic and tag pages, and an article for each guide. No ratings,
 * reviews or offers: the directory has none.
 */
function rbr_schema(): array {
  $title = fn($p) => html_entity_decode(get_the_title($p), ENT_QUOTES | ENT_HTML5, 'UTF-8');
  if (is_search() || is_404() || is_front_page()) return [];
  $crumbs = [['RandyBuilds.tech', RBR_MAIN . '/'], ['Resources', home_url('/')]];
  $out = [];
  $list = function (string $name, string $url, string $desc, array $posts) use ($title) {
    return ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => $name, 'url' => $url,
      'description' => $desc, 'isPartOf' => ['@type' => 'WebSite', 'name' => 'RandyBuilds.tech', 'url' => RBR_MAIN . '/'],
      'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($posts),
        'itemListElement' => array_map(fn($p, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'url' => get_permalink($p), 'name' => $title($p)], $posts, array_keys($posts))]];
  };
  if (is_home()) {
    $crumbs[] = ['Directory', rbr_canonical()];
    if (!rbr_is_filtered()) {
      $guides = rbr_guides_term();
      $posts = get_posts(['post_type' => 'post', 'posts_per_page' => -1, 'category__not_in' => array_filter([$guides?->term_id]), 'orderby' => 'title', 'order' => 'ASC']);
      $out[] = $list('Resource directory', rbr_canonical(), rbr_description(), $posts);
    }
  } elseif (is_category() || is_tag()) {
    if (is_tag()) $crumbs[] = ['Directory', home_url('/directory/')];
    $crumbs[] = [single_term_title('', false), rbr_canonical()];
    global $wp_query;
    $out[] = $list(single_term_title('', false), rbr_canonical(), rbr_description(), $wp_query->posts);
  } elseif (is_singular('post')) {
    $p = get_queried_object();
    if ($t = rbr_topic($p)) $crumbs[] = [$t->name, get_category_link($t)];
    $crumbs[] = [$title($p), get_permalink($p)];
    if (rbr_is_guide($p)) {
      $out[] = ['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => $title($p),
        'description' => rbr_description(), 'url' => get_permalink($p), 'mainEntityOfPage' => get_permalink($p),
        'image' => RBR_MAIN . '/og.png', 'datePublished' => get_the_date('c', $p), 'dateModified' => get_the_modified_date('c', $p),
        'author' => ['@type' => 'Person', 'name' => 'Randy', 'url' => RBR_MAIN . '/'],
        'publisher' => ['@type' => 'Person', 'name' => 'Randy', 'url' => RBR_MAIN . '/']];
    }
  } else {
    return [];
  }
  array_unshift($out, ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList',
    'itemListElement' => array_map(fn($c, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $c[0], 'item' => $c[1]], $crumbs, array_keys($crumbs))]);
  return $out;
}

function rbr_description(): string {
  if (is_singular()) {
    $p = get_queried_object();
    if (is_front_page() || (int) $p->ID === (int) get_option('page_for_posts')) return get_bloginfo('description');
    return wp_strip_all_tags(get_the_excerpt($p));
  }
  if (is_home()) return 'Every listing in one place: free tools, official guidance and courses for small businesses and their websites. Filter by topic, type, cost and who it suits.';
  if (is_category() || is_tag()) return trim(wp_strip_all_tags(term_description())) ?: get_bloginfo('description');
  return get_bloginfo('description');
}

add_filter('document_title_separator', fn() => '·');
add_filter('document_title_parts', function ($parts) {
  if (is_front_page()) return ['title' => 'Resources: free tools and guides for small businesses', 'site' => 'RandyBuilds.tech'];
  if (is_home()) $parts['title'] = 'Resource directory: free tools and guides for small businesses';
  elseif (is_category() && !is_category('guides')) $parts['title'] = single_cat_title('', false) . ': free resources';
  elseif (is_category('guides')) $parts['title'] = 'Practical guides for small business websites';
  elseif (is_tag()) $parts['title'] = single_tag_title('', false) . ' · Resource directory';
  elseif (is_singular('post') && !rbr_is_guide()) {
    // "Contrast Checker by WebAIM": the publisher tells listings with generic names apart.
    $pub = rbr_meta('rbr_publisher', get_queried_object());
    if ($pub && stripos($parts['title'], strtok($pub, ' ,')) === false) $parts['title'] .= " by $pub";
  }
  $parts['site'] = 'RandyBuilds.tech Resources';
  unset($parts['tagline'], $parts['page']);
  if (is_paged()) $parts['title'] .= ' · page ' . (int) get_query_var('paged');
  return $parts;
});

// ── Topic context: a guide from this site and the service it relates to ─
// Shown once per topic page (and on the directory filtered to a topic), never on cards.
// Topics without a matching service (security, finance, marketing, learning) get no pitch.
const RBR_TOPIC_NEXT = [
  'starting-and-planning'           => ['guide' => 'before-you-ask-for-a-website', 'service' => 'websites'],
  'website-planning-and-content'    => ['guide' => 'website-project-checklist', 'service' => 'websites'],
  'website-platforms-and-web-tools' => ['guide' => 'quick-fix-or-rebuild', 'service' => 'existing-projects'],
  'accessibility'                   => ['guide' => 'basic-accessibility-review', 'service' => 'existing-projects'],
  'search-visibility-and-analytics' => ['guide' => '', 'service' => 'websites-seo'],
  'booking-forms-and-operations'    => ['guide' => 'booking-forms-and-ordering', 'service' => 'web-apps'],
];
// Wording from the main site's services (src/content/services.ts); no new claims.
const RBR_SERVICE_LINES = [
  'websites'          => ['Rather have it built?', 'I build business websites with a written scope and a fixed price before work starts.', '/services/websites/', 'New business websites'],
  'websites-seo'      => ['Rather have it built?', 'Every new business website I build includes basic SEO setup, with a written scope and a fixed price.', '/services/websites/', 'New business websites'],
  'existing-projects' => ['Rather not fix it yourself?', 'Website improvements are clearly scoped fixes to pages, forms and mobile layouts on a site that mostly works, at a fixed price.', '/services/existing-projects/', 'Website improvements'],
  'web-apps'          => ['Need something built around how you work?', 'I build booking systems, dashboards and other business tools, with a written scope and a fixed price.', '/services/web-apps/', 'Custom web applications'],
];
/** The guide post and service line for a topic, either of which may be missing. */
function rbr_topic_next(?WP_Term $topic): array {
  $map = $topic ? (RBR_TOPIC_NEXT[$topic->slug] ?? null) : null;
  if (!$map) return ['guide' => null, 'service' => null];
  $g = $map['guide'] ? get_page_by_path($map['guide'], OBJECT, 'post') : null;
  return ['guide' => $g && $g->post_status === 'publish' ? $g : null, 'service' => RBR_SERVICE_LINES[$map['service']] ?? null];
}

// ── Security defaults (no plugin needed) ───────────────────────────────
add_filter('xmlrpc_enabled', '__return_false');
add_filter('wp_headers', function ($h) { unset($h['X-Pingback']); return $h; });
add_filter('comments_open', '__return_false', 20);
add_filter('pings_open', '__return_false', 20);
add_filter('comments_array', '__return_empty_array', 10);
add_action('admin_menu', fn() => remove_menu_page('edit-comments.php'));
add_action('admin_bar_menu', fn($bar) => $bar->remove_node('comments'), 60);
// User names stay private: no author archives, no user list in the REST API or sitemap.
add_action('template_redirect', function () {
  if (is_author() || isset($_GET['author'])) { wp_safe_redirect(home_url('/'), 301); exit; }
}, 1);   // before redirect_canonical, which would reveal /author/<login>/
add_filter('rest_endpoints', function ($e) {
  if (!is_user_logged_in()) { unset($e['/wp/v2/users'], $e['/wp/v2/users/(?P<id>[\d]+)']); }
  return $e;
});
add_filter('wp_sitemaps_add_provider', fn($provider, $name) => $name === 'users' ? false : $provider, 10, 2);
add_filter('login_errors', fn() => 'The username or password is not right.');

// ── Search: also match a listing's keywords and publisher ──────────────
add_filter('posts_search', function ($search, $q) {
  global $wpdb;
  if (!$q->is_search() || !$q->is_main_query() && !$q->get('rbr_search') || empty($q->get('search_terms'))) return $search;
  $clauses = [];
  foreach ($q->get('search_terms') as $term) {
    $like = '%' . $wpdb->esc_like($term) . '%';
    $clauses[] = $wpdb->prepare(
      "({$wpdb->posts}.post_title LIKE %s OR {$wpdb->posts}.post_excerpt LIKE %s OR {$wpdb->posts}.post_content LIKE %s
        OR {$wpdb->posts}.ID IN (SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key IN ('rbr_keywords','rbr_publisher','rbr_good_for') AND meta_value LIKE %s))",
      $like, $like, $like, $like);
  }
  return ' AND (' . implode(' AND ', $clauses) . ') ';
}, 10, 2);

add_action('pre_get_posts', function ($q) {
  if (is_admin() || !$q->is_main_query()) return;
  if ($q->is_search()) { $q->set('post_type', 'post'); $q->set('posts_per_page', 30); }
  if ($q->is_category() || $q->is_tag()) $q->set('posts_per_page', 60);
});

// ── Helpers used by the templates ──────────────────────────────────────
function rbr_meta(string $key, $post = null): string {
  return (string) get_post_meta(get_post($post)->ID, $key, true);
}
function rbr_is_guide($post = null): bool { return rbr_meta('rbr_kind', $post) === 'guide' || has_category('guides', $post); }
function rbr_topic($post = null): ?WP_Term {
  $cats = get_the_category(get_post($post)->ID);
  return $cats ? $cats[0] : null;
}
function rbr_color(?WP_Term $term): string {
  $c = $term ? get_term_meta($term->term_id, 'rbr_color', true) : '';
  return in_array($c, ['cobalt', 'orange', 'sea', 'yellow'], true) ? $c : 'cobalt';
}
/** Topics in the hub's order (Guides excluded). */
function rbr_topics(): array {
  $terms = get_terms(['taxonomy' => 'category', 'hide_empty' => true, 'exclude' => [get_option('default_category')]]);
  $terms = array_filter($terms, fn($t) => $t->slug !== 'guides');
  usort($terms, fn($a, $b) => (int) get_term_meta($a->term_id, 'rbr_order', true) <=> (int) get_term_meta($b->term_id, 'rbr_order', true));
  return $terms;
}
function rbr_guides_term(): ?WP_Term { return get_term_by('slug', 'guides', 'category') ?: null; }
/** Tags of one group (type, cost, audience), sorted by name. */
function rbr_tags(string $group): array {
  return get_terms(['taxonomy' => 'post_tag', 'hide_empty' => true, 'orderby' => 'name',
    'meta_query' => [['key' => 'rbr_group', 'value' => $group]]]);
}
function rbr_minutes($post = null): int {
  $words = str_word_count(wp_strip_all_tags(get_post($post)->post_content));
  return max(1, (int) round($words / 220));
}
function rbr_price_label(string $price): string {
  return ['free' => 'Free', 'free-tier' => 'Free tier', 'free-trial' => 'Free trial'][$price] ?? '';
}
// A listing's address for display: no scheme, "www." or trailing slash (wave.webaim.org).
function rbr_display_url(string $url): string {
  return rtrim(preg_replace('#^https?://(www\.)?#i', '', $url), '/');
}

function rbr_external_icon(): string {
  return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/** Listings named in a guide's rbr_related field (comma-separated slugs), in that order. */
function rbr_related($post = null): array {
  $slugs = array_filter(array_map('trim', explode(',', rbr_meta('rbr_related', $post))));
  $out = [];
  foreach ($slugs as $slug) {
    $p = get_page_by_path($slug, OBJECT, 'post');
    if ($p && $p->post_status === 'publish') $out[] = $p;
  }
  return $out;
}
/** Level-2 headings with an anchor, for a guide's "On this page". */
function rbr_toc($post = null): array {
  $toc = [];
  foreach (parse_blocks(get_post($post)->post_content) as $b) {
    if ($b['blockName'] !== 'core/heading' || ($b['attrs']['level'] ?? 2) !== 2) continue;
    if (preg_match('/<h2[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h2>/s', $b['innerHTML'], $m)) $toc[] = ['id' => $m[1], 'text' => wp_strip_all_tags($m[2])];
  }
  return $toc;
}
