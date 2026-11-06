<?php
/**
 * Imports the Resources section (migrate/data.json, made by export.mjs) as posts.
 * Run by `rbr.sh import` (wp eval-file). Safe to run again: posts are matched by
 * slug and updated in place, so edits made in WordPress to a post the import
 * also covers are overwritten. Once Randy edits content in WordPress, stop
 * re-importing (README.md, "Content").
 *
 * - Topics → categories (description = the topic's line, colour in term meta).
 * - Guides → posts in the Guides category; body is the live page's HTML as blocks.
 * - Listings → posts in their topic; type, cost, audience and "Good first stop" → tags.
 * Wording, links and attribution are kept as they are on randybuilds.tech.
 */

if (!defined('ABSPATH')) exit;

$data = json_decode(file_get_contents('/migrate/data.json'), true);
if (!$data) WP_CLI::error('migrate/data.json missing or invalid: run export.mjs first');

$esc = fn($s) => esc_html($s);

// ── Taxonomy ───────────────────────────────────────────────────────────
function rbr_term(string $name, string $taxonomy, string $description = '', array $meta = []): int {
  $slug = sanitize_title($name);
  $t = get_term_by('slug', $slug, $taxonomy);
  $id = $t ? (int) $t->term_id : (int) wp_insert_term($name, $taxonomy, ['slug' => $slug])['term_id'];
  wp_update_term($id, $taxonomy, ['name' => $name, 'description' => $description]);
  foreach ($meta as $k => $v) update_term_meta($id, $k, $v);
  return $id;
}

$cats = [];
foreach ($data['categories'] as $i => $c) {
  $cats[$c['id']] = rbr_term($c['title'], 'category', $c['line'], ['rbr_color' => $c['color'], 'rbr_order' => $i + 1, 'rbr_source_id' => $c['id']]);
}
$guides_cat = rbr_term('Guides', 'category',
  'Practical, plain-language guides to common website and business tasks. Each one ends with free resources that help with the next step.',
  ['rbr_color' => 'sea', 'rbr_order' => 0, 'rbr_source_id' => 'guides']);

$tag = fn(string $name, string $group) => rbr_term($name, 'post_tag', '', ['rbr_group' => $group]);
$start_tag = $tag('Good first stop', 'start');

// ── Blocks from the live page's HTML ───────────────────────────────────
function rbr_inner(DOMNode $n): string {
  $html = '';
  foreach ($n->childNodes as $c) $html .= $n->ownerDocument->saveHTML($c);
  return trim($html);
}
function rbr_blocks(string $html, bool $checklist): string {
  $doc = new DOMDocument();
  libxml_use_internal_errors(true);
  $doc->loadHTML('<?xml encoding="utf-8"?><div id="rbr-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
  $root = $doc->getElementById('rbr-root');
  $out = [];
  foreach ($root->childNodes as $n) {
    if (!($n instanceof DOMElement)) continue;
    $tag = strtolower($n->tagName);
    $inner = rbr_inner($n);
    switch ($tag) {
      case 'p':
        $out[] = "<!-- wp:paragraph -->\n<p>$inner</p>\n<!-- /wp:paragraph -->";
        break;
      case 'h2': case 'h3':
        $level = (int) $tag[1];
        $attrs = $level === 2 ? '' : ' {"level":' . $level . '}';
        $id = $n->getAttribute('id');
        $idattr = $id ? ' id="' . esc_attr($id) . '"' : '';
        $out[] = "<!-- wp:heading$attrs -->\n<$tag class=\"wp-block-heading\"$idattr>$inner</$tag>\n<!-- /wp:heading -->";
        break;
      case 'ul': case 'ol':
        $attrs = [];
        $class = 'wp-block-list';
        if ($tag === 'ol') $attrs['ordered'] = true;
        if ($checklist && $tag === 'ul') { $attrs['className'] = 'is-style-checklist'; $class .= ' is-style-checklist'; }
        $items = '';
        foreach ($n->childNodes as $li) {
          if ($li instanceof DOMElement && strtolower($li->tagName) === 'li') {
            $items .= "<!-- wp:list-item -->\n<li>" . rbr_inner($li) . "</li>\n<!-- /wp:list-item -->\n";
          }
        }
        $json = $attrs ? ' ' . wp_json_encode($attrs) : '';
        $out[] = "<!-- wp:list$json -->\n<$tag class=\"$class\">$items</$tag>\n<!-- /wp:list -->";
        break;
      case 'blockquote':
        $paras = '';
        foreach ($n->childNodes as $p) {
          if ($p instanceof DOMElement && strtolower($p->tagName) === 'p') {
            $paras .= "<!-- wp:paragraph -->\n<p>" . rbr_inner($p) . "</p>\n<!-- /wp:paragraph -->\n";
          }
        }
        $out[] = "<!-- wp:quote -->\n<blockquote class=\"wp-block-quote\">$paras</blockquote>\n<!-- /wp:quote -->";
        break;
      default:
        WP_CLI::error("unexpected <$tag> in a guide: add it to rbr_blocks()");
    }
  }
  return implode("\n\n", $out);
}

function rbr_upsert(array $post, array $meta, array $terms): int {
  $existing = get_page_by_path($post['post_name'], OBJECT, 'post');
  $post += ['post_type' => 'post', 'post_status' => 'publish', 'comment_status' => 'closed', 'ping_status' => 'closed', 'post_author' => 1];
  if ($existing) $post['ID'] = $existing->ID;
  // wp_insert_post expects slashed data. Content passes the normal kses filter
  // (WP-CLI runs as no user), which keeps everything the blocks use.
  $id = wp_insert_post(wp_slash($post), true);
  if (is_wp_error($id)) WP_CLI::error($post['post_name'] . ': ' . $id->get_error_message());
  foreach ($meta as $k => $v) update_post_meta($id, $k, $v);
  wp_set_post_terms($id, $terms['category'] ?? [], 'category');
  wp_set_post_terms($id, $terms['post_tag'] ?? [], 'post_tag');
  return $id;
}

// ── Guides ─────────────────────────────────────────────────────────────
$count_guides = 0;
foreach ($data['guides'] as $g) {
  $date = substr($g['published'], 0, 10) . ' 18:00:00';
  $date = date('Y-m-d H:i:s', strtotime($date) - 60 * (int) $g['order']);   // newest first = the hub's order
  $tags = !empty($g['checklist']) ? [$tag($data['typeLabels']['checklist'], 'type')] : [];
  $help = $g['help'] ? preg_replace('#href="/#', 'href="https://randybuilds.tech/', preg_replace('# class="textlink"#', '', $g['help'])) : '';
  rbr_upsert([
    'post_name'    => $g['slug'],
    'post_title'   => html_entity_decode($g['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
    'post_excerpt' => html_entity_decode($g['description'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
    'post_content' => rbr_blocks($g['body'], !empty($g['checklist'])),
    'post_date'    => $date,
    'post_modified' => !empty($g['updated']) ? $g['updated'] . ' 12:00:00' : $date,
  ], [
    'rbr_kind'      => 'guide',
    'rbr_summary'   => $g['summary'],
    'rbr_featured'  => !empty($g['featured']) ? '1' : '',
    'rbr_checklist' => !empty($g['checklist']) ? '1' : '',
    'rbr_related'   => implode(', ', $g['related'] ?? []),
    'rbr_help'      => $help,
    'rbr_source'    => 'https://randybuilds.tech/resources/guides/' . $g['slug'] . '/',
  ], ['category' => [$guides_cat], 'post_tag' => $tags]);
  $count_guides++;
}

// ── Listings ───────────────────────────────────────────────────────────
$checked_fmt = fn($d) => date('M j, Y', strtotime($d . ' 12:00:00'));
$count = 0;
foreach ($data['resources'] as $i => $r) {
  $price = $data['priceLabels'][$r['price']];
  $type = $data['typeLabels'][$r['type']];
  $account = isset($r['account']) ? $data['accountLabels'][$r['account']] : 'Not checked';
  $cost = $price . (!empty($r['priceNote']) ? ' — ' . $r['priceNote'] : '');
  $content = implode("\n\n", [
    "<!-- wp:paragraph -->\n<p>" . $esc($r['description']) . "</p>\n<!-- /wp:paragraph -->",
    "<!-- wp:paragraph {\"className\":\"res-for\"} -->\n<p class=\"res-for\"><strong>Good for</strong> " . $esc($r['goodFor']) . "</p>\n<!-- /wp:paragraph -->",
    "<!-- wp:list {\"className\":\"res-facts\"} -->\n<ul class=\"wp-block-list res-facts\">"
      . "<!-- wp:list-item -->\n<li><strong>Publisher</strong> " . $esc($r['publisher']) . "</li>\n<!-- /wp:list-item -->\n"
      . "<!-- wp:list-item -->\n<li><strong>Cost</strong> " . $esc($cost) . "</li>\n<!-- /wp:list-item -->\n"
      . "<!-- wp:list-item -->\n<li><strong>Account</strong> " . $esc($account) . "</li>\n<!-- /wp:list-item -->\n"
      . "<!-- wp:list-item -->\n<li><strong>Checked</strong> " . $esc($checked_fmt($r['checked'])) . "</li>\n<!-- /wp:list-item -->\n"
      . "</ul>\n<!-- /wp:list -->",
    "<!-- wp:buttons -->\n<div class=\"wp-block-buttons\"><!-- wp:button -->\n<div class=\"wp-block-button\"><a class=\"wp-block-button__link wp-element-button\" href=\"" . esc_url($r['url']) . "\" rel=\"noopener noreferrer external\">Visit site</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->",
  ]);
  $tags = [$tag($type, 'type'), $tag($price, 'cost')];
  foreach ($r['audience'] as $a) {
    foreach ($data['audiences'] as $aud) if ($aud['id'] === $a) $tags[] = $tag($aud['label'], 'audience');
  }
  if (!empty($r['start'])) $tags[] = $start_tag;
  $date = date('Y-m-d H:i:s', strtotime($r['checked'] . ' 12:00:00') - 60 * $i);   // newest first = the directory's order
  rbr_upsert([
    'post_name'    => $r['id'],
    'post_title'   => $r['name'],
    'post_excerpt' => $r['description'],
    'post_content' => $content,
    'post_date'    => $date,
  ], [
    'rbr_kind'       => 'listing',
    'rbr_publisher'  => $r['publisher'],
    'rbr_url'        => $r['url'],
    'rbr_host'       => $r['host'],
    'rbr_good_for'   => $r['goodFor'],
    'rbr_type'       => $type,
    'rbr_price'      => $r['price'],
    'rbr_price_note' => $r['priceNote'] ?? '',
    'rbr_account'    => $account,
    'rbr_checked'    => $r['checked'],
    'rbr_keywords'   => implode(', ', $r['keywords'] ?? []),
    'rbr_source'     => 'https://randybuilds.tech/resources/directory/#r-' . $r['id'],
  ], ['category' => [$cats[$r['category']]], 'post_tag' => $tags]);
  $count++;
}

// Header menu: add Guides after Directory if the menu doesn't have it yet.
$menu = wp_get_nav_menu_object('Header');
if ($menu) {
  $has = array_filter(wp_get_nav_menu_items($menu->term_id) ?: [], fn($i) => $i->object === 'category' && (int) $i->object_id === $guides_cat);
  if (!$has) {
    wp_update_nav_menu_item($menu->term_id, 0, [
      'menu-item-title' => 'Guides', 'menu-item-object' => 'category', 'menu-item-object-id' => $guides_cat,
      'menu-item-type' => 'taxonomy', 'menu-item-status' => 'publish', 'menu-item-position' => 2,
    ]);
    // Keep the order Directory · Guides · Topics · RandyBuilds.tech.
    $order = ['Directory' => 1, 'Guides' => 2, 'Topics' => 3, 'RandyBuilds.tech' => 4];
    foreach (wp_get_nav_menu_items($menu->term_id) as $item) {
      if (isset($order[$item->title])) wp_update_post(['ID' => $item->ID, 'menu_order' => $order[$item->title]]);
    }
  }
}

WP_CLI::success("imported $count_guides guides and $count listings");
