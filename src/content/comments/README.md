<!--
Moderated reader comments — one Markdown file per comment. This is a MACHINE-managed folder:
the Disqus-archive importer seeds the historical threads, and the /api/comments serverless
endpoint writes new ones. You don't hand-author here — you MODERATE in Sveltia ("Comments —
moderation"): flip `approved` on to publish, or delete a file to remove it.

File shape (frontmatter + the comment text as the body):

    ---
    post: <blog-post-slug>      # matches a src/content/posts entry id
    author: <display name>
    date: 2018-03-14T09:20:00Z
    approved: false             # the render gate; readers' comments arrive false
    parent: <comment-id>        # optional — the comment this replies to
    website: https://…          # optional link, rendered rel="nofollow ugc"
    source: disqus | site       # provenance; 'disqus' shows a "from the archive" tag
    ---
    The comment text. Rendered escaped + linkified, never as raw HTML/Markdown.

Email is NEVER stored here — the repo is public. This README (a `_`-free .md with no `post`
field) is ignored by the loader's frontmatter parse and never renders as a comment.
-->

This folder holds moderated reader comments. See the HTML comment above for the file format.
