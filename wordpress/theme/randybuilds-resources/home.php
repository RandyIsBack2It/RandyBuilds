<?php
// The directory (/directory/, the "posts page"): every listing, grouped by topic,
// with filters by topic, type, cost and audience plus a search box. The filters
// are a plain GET form, mirrored in the address bar, and work without JavaScript.
if (!defined('ABSPATH')) exit;
get_header();

$get = fn($k) => isset($_GET[$k]) ? sanitize_title(wp_unslash((string) $_GET[$k])) : '';
$q = isset($_GET['q']) ? sanitize_text_field(wp_unslash((string) $_GET['q'])) : '';
$topic = $get('topic');
$filters = ['type' => $get('type'), 'cost' => $get('cost'), 'audience' => $get('audience')];
$guides = rbr_guides_term();
$base = ['post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1, 'no_found_rows' => true,
  'category__not_in' => array_filter([$guides?->term_id])];
$tax = [];
foreach ($filters as $slug) if ($slug) $tax[] = ['taxonomy' => 'post_tag', 'field' => 'slug', 'terms' => $slug];
if ($topic) $tax[] = ['taxonomy' => 'category', 'field' => 'slug', 'terms' => $topic];
if ($tax) $base['tax_query'] = ['relation' => 'AND', ...$tax];
if ($q !== '') { $base['s'] = $q; $base['rbr_search'] = true; }
$filtered = $tax || $q !== '';
$total = (int) (new WP_Query(['post_type' => 'post', 'posts_per_page' => 1, 'fields' => 'ids', 'category__not_in' => $base['category__not_in']]))->found_posts;

$select = function (string $name, string $label, array $terms, string $current, string $all) {
  $id = 'f-' . $name;
  echo '<div class="field"><label for="' . esc_attr($id) . '">' . esc_html($label) . '</label><select id="' . esc_attr($id) . '" name="' . esc_attr($name) . '">';
  echo '<option value="">' . esc_html($all) . '</option>';
  foreach ($terms as $t) printf('<option value="%s"%s>%s</option>', esc_attr($t->slug), selected($current, $t->slug, false), esc_html($t->name));
  echo '</select></div>';
};
?>
<div class="page-head--color" data-color="cobalt">
  <div class="wrap page-head">
    <p class="crumb"><a href="<?php echo esc_url(home_url('/')); ?>">Resources</a></p>
    <p class="kicker"><b>~/</b>resources / directory</p>
    <h1>Resource directory</h1>
    <p class="lede"><?php echo (int) $total; ?> free resources for running a small business and its website. Each listing says what’s free, who it suits and when it was last checked.</p>
    <p class="res-policy"><strong>How listings are chosen.</strong> Each one is picked for its use to small businesses and website owners. Some are suggested by their publishers; every suggestion is reviewed by hand, and not all are listed. A listing is not an endorsement or a partnership. <a class="textlink" href="<?php echo esc_url(RBR_MAIN . '/resources/suggest/'); ?>">Suggest a resource</a></p>
  </div>
</div>

<section class="section section--tight" aria-label="All resources">
  <div class="wrap">
    <form class="res-filters" method="get" action="<?php echo esc_url(home_url('/directory/')); ?>" role="search" aria-label="Filter the directory">
      <div class="res-search">
        <label for="f-q">Search the directory</label>
        <div class="res-search__row">
          <input id="f-q" name="q" type="search" maxlength="100" autocomplete="off" spellcheck="false" value="<?php echo esc_attr($q); ?>" placeholder="Name, publisher or task">
        </div>
      </div>
      <div class="res-filters__row">
        <?php
        $select('topic', 'Topic', rbr_topics(), $topic, 'All topics');
        $select('type', 'Type', rbr_tags('type'), $filters['type'], 'All types');
        $select('cost', 'Cost', rbr_tags('cost'), $filters['cost'], 'Any cost');
        $select('audience', 'Good for', rbr_tags('audience'), $filters['audience'], 'Anyone');
        ?>
      </div>
      <div class="res-filters__foot">
        <button class="btn btn--small btn--orange" type="submit">Show resources</button>
        <?php if ($filtered) : ?><a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">Clear filters</a><?php endif; ?>
      </div>
    </form>

    <?php if ($filtered) :
      $res = new WP_Query($base); ?>
      <p class="res-filters__count" role="status"><?php echo esc_html(sprintf(_n('%d resource matches', '%d resources match', $res->post_count), $res->post_count)); ?></p>
      <?php if ($res->have_posts()) : ?>
        <ul class="res-grid">
          <?php while ($res->have_posts()) { $res->the_post(); get_template_part('template-parts/card', 'resource'); } wp_reset_postdata(); ?>
        </ul>
      <?php else : ?>
        <div class="res-empty">
          <h2>Nothing matches</h2>
          <p>Try fewer words, or clear a filter.</p>
          <a class="textlink" href="<?php echo esc_url(home_url('/directory/')); ?>">Clear filters</a>
        </div>
      <?php endif; ?>
      <?php if ($topic && ($t = get_term_by('slug', $topic, 'category'))) get_template_part('template-parts/topic', 'next', ['topic' => $t]); ?>
    <?php else :
      foreach (rbr_topics() as $t) :
        $res = new WP_Query($base + ['cat' => $t->term_id]);
        if (!$res->have_posts()) continue; ?>
        <section class="res-group" id="<?php echo esc_attr($t->slug); ?>" data-color="<?php echo esc_attr(rbr_color($t)); ?>" aria-labelledby="h-<?php echo esc_attr($t->slug); ?>">
          <div class="res-group__head">
            <h2 id="h-<?php echo esc_attr($t->slug); ?>"><span class="band-chip" aria-hidden="true"></span><a href="<?php echo esc_url(get_category_link($t)); ?>"><?php echo esc_html($t->name); ?></a></h2>
            <p><?php echo esc_html($t->description); ?></p>
          </div>
          <ul class="res-grid">
            <?php while ($res->have_posts()) { $res->the_post(); get_template_part('template-parts/card', 'resource'); } wp_reset_postdata(); ?>
          </ul>
        </section>
      <?php endforeach;
    endif; ?>

    <?php if ($guides) : ?>
      <p class="note">Looking for step-by-step help? See the <a class="textlink" href="<?php echo esc_url(get_category_link($guides)); ?>">practical guides</a>.</p>
    <?php endif; ?>
    <p class="note">Need something more specific to your business? I build business websites, custom tools and improvements to existing sites. <a class="textlink" href="<?php echo esc_url(RBR_MAIN . '/services/'); ?>">See services</a></p>
    <p class="note res-disclaimer"><?php echo esc_html(RBR_DISCLAIMER); ?></p>
  </div>
</section>
<?php get_footer();
