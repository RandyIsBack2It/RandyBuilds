<?php
// A guide or a listing, whichever this post is.
if (!defined('ABSPATH')) exit;
get_template_part('template-parts/card', rbr_is_guide() ? 'guide' : 'resource', $args ?? []);
