---
layout: page
title: Tech Info Feed
permalink: /techinfo/
---

<div class="post-list">
  {% for item in site.techinfo reversed %}
    <div class="post-item">
      <div class="post-item-info">
        <h2 class="post-title">
          <a href="{{ item.url | relative_url }}">{{ item.title }}</a>
        </h2>
        <div class="post-meta">
          <i class="far fa-calendar fa-fw"></i>
          <span>{{ item.date | date: "%Y-%m-%d" }}</span>
          <i class="far fa-folder-open fa-fw"></i>
          <span>From <em>{{ item.tags[0] }}</em></span>
        </div>
      </div>
      <div class="post-content">
        <p>{{ item.content | strip_html | truncatewords: 40 }}</p>
      </div>
    </div>
  {% endfor %}
</div>