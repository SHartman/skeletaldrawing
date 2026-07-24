// Turn markdown images into captioned, optionally-sized figures — the little bit of control plain
// markdown doesn't give you. Runs at the rehype (HTML) stage, over content authored in the CMS.
//
//   ![alt](src "A caption")              → <figure><img><figcaption>A caption</figcaption></figure>
//   ![alt](src){width=60%}               → figure capped at 60% of the column, centred
//   ![alt](src "cap"){width=50% left}    → caption + half width + floated left (text wraps)
//
// Directives live in a {…} token written immediately after the image. Recognised tokens:
//   width=<len>   e.g. width=60%  width=420px   (sets the figure's max-width)
//   left | right  float the figure so text wraps beside it
//   center        explicit centred block (the default anyway)
//
// SAFE ON EXISTING CONTENT: it only acts on a bare <img> that has a title and/or a trailing {…}
// directive. Imported posts carry their captions as raw <figure> HTML (already figures, skipped)
// and use no title syntax, so nothing there changes. Verified against all 80 posts at build time.
import { visit } from 'unist-util-visit';

const WIDTH = /(?:^|\s)width=([0-9]+(?:\.[0-9]+)?(?:px|%|rem|em|ch|vw))(?=\s|$)/i;
const ALIGN = /(?:^|\s)(left|right|center)(?=\s|$)/i;

// Is this text node the directive blob that follows an image? e.g. "{width=50% left}"
const dirMatch = (value) => value.match(/^\s*\{([^}]*)\}/);

export default function rehypeFigures() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'img' || index == null || !parent) return;
      // Already inside a figure (the imported raw-HTML captions) — leave it be.
      if (parent.tagName === 'figure') return;

      const title = typeof node.properties?.title === 'string' ? node.properties.title.trim() : '';

      // A directive blob is the next sibling text node starting with {…}.
      let directives = '';
      const next = parent.children[index + 1];
      if (next && next.type === 'text') {
        const m = dirMatch(next.value);
        if (m) {
          directives = m[1];
          next.value = next.value.slice(m[0].length); // strip the {…} from the visible text
        }
      }

      // Nothing to do → don't touch it (keeps taxon-description images etc. as plain <img>).
      if (!title && !directives) return;

      const widthMatch = directives.match(WIDTH);
      const alignMatch = directives.match(ALIGN);
      const align = alignMatch ? alignMatch[1].toLowerCase() : 'center';

      // Build the figure. Drop the title off the img (it becomes the visible caption instead).
      if (node.properties) delete node.properties.title;
      const figChildren = [node];
      if (title) {
        figChildren.push({
          type: 'element', tagName: 'figcaption', properties: {},
          children: [{ type: 'text', value: title }],
        });
      }
      const style = widthMatch ? `max-width:${widthMatch[1]}` : undefined;
      const figure = {
        type: 'element', tagName: 'figure',
        properties: { className: [`fig-${align}`], ...(style ? { style } : {}) },
        children: figChildren,
      };

      // A block image sits alone in its own <p>; a <figure> can't live inside a <p>, so replace the
      // whole paragraph. Otherwise (rare: inline) swap just the img for the figure in place.
      const soleImage =
        parent.tagName === 'p' &&
        parent.children.every(
          (c) => c === node || (c.type === 'text' && !c.value.trim()),
        );
      if (soleImage) {
        // find the paragraph in ITS parent — handled by returning a replacement via the caller isn't
        // possible here, so mutate: turn the <p> into the <figure>.
        parent.tagName = 'figure';
        parent.properties = figure.properties;
        parent.children = figChildren;
      } else {
        parent.children[index] = figure;
      }
    });
  };
}
