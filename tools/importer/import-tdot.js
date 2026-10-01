/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroVideoParser from "./parsers/hero-video.js";
import alertSlimParser from "./parsers/alert-slim.js";
import columnsLinksParser from "./parsers/columns-links.js";
import cardsNewsParser from "./parsers/cards-news.js";
import columnsFeatureParser from "./parsers/columns-feature.js";
import columnsStatsParser from "./parsers/columns-stats.js";
import columnsCalloutParser from "./parsers/columns-callout.js";
import cardsPeopleParser from "./parsers/cards-people.js";
import columnsMediaParser from "./parsers/columns-media.js";
import cardsTilesParser from "./parsers/cards-tiles.js";

// TRANSFORMER IMPORTS
import cleanupTransformer from "./transformers/tdot-cleanup.js";
import sectionsTransformer from "./transformers/tdot-sections.js";
import { localizeImages } from "./lib/tn-common.js";

// PARSER REGISTRY
const parsers = {
  "hero-video": heroVideoParser,
  "alert-slim": alertSlimParser,
  "columns-links": columnsLinksParser,
  "cards-news": cardsNewsParser,
  "columns-feature": columnsFeatureParser,
  "columns-stats": columnsStatsParser,
  "columns-callout": columnsCalloutParser,
  "cards-people": cardsPeopleParser,
  "columns-media": columnsMediaParser,
  "cards-tiles": cardsTilesParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  "name": "tdot",
  "description": "TDOT agency homepage: video hero, project update alert, quick-link columns, news cards, feature/stats/callout columns, people cards, and transport-mode tiles. All blocks map to existing USWDS blocks (hero, alert, columns, cards) with variant classes.",
  "urls": [
    "https://www.tn.gov/tdot.html"
  ],
  "blocks": [
    {
      "name": "hero-video",
      "instances": [
        ".tn-video-hero"
      ]
    },
    {
      "name": "alert-slim",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(3)"
      ]
    },
    {
      "name": "columns-links",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(4)"
      ]
    },
    {
      "name": "cards-news",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(6)"
      ]
    },
    {
      "name": "columns-feature",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(7)"
      ]
    },
    {
      "name": "columns-stats",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(9)"
      ]
    },
    {
      "name": "columns-callout",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(11)"
      ]
    },
    {
      "name": "cards-people",
      "instances": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(13)"
      ]
    },
    {
      "name": "columns-media",
      "instances": [
        "#main > div:nth-of-type(2) > div.tn-panel > .panel > div > div.columnctrl:nth-of-type(2)"
      ]
    },
    {
      "name": "cards-tiles",
      "instances": [
        "#main > div:nth-of-type(2) > div.tn-panel > .panel > div > div.columnctrl:nth-of-type(3)"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "Video hero",
      "selector": [
        ".tn-video-hero"
      ],
      "style": null,
      "blocks": [
        "hero-video"
      ],
      "defaultContent": []
    },
    {
      "id": "2",
      "name": "Project update strip",
      "selector": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(3)"
      ],
      "style": null,
      "blocks": [
        "alert-slim"
      ],
      "defaultContent": []
    },
    {
      "id": "3",
      "name": "Quick links",
      "selector": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(4)"
      ],
      "style": "dark",
      "blocks": [
        "columns-links"
      ],
      "defaultContent": []
    },
    {
      "id": "4",
      "name": "Building Tennessee's Future",
      "selector": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(5)"
      ],
      "style": null,
      "blocks": [
        "cards-news"
      ],
      "defaultContent": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(5)"
      ]
    },
    {
      "id": "5",
      "name": "Delivery. Accountability. Results.",
      "selector": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(7)"
      ],
      "style": "dark",
      "blocks": [
        "columns-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "6",
      "name": "Relentlessly Pursuing Excellence",
      "selector": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(8)"
      ],
      "style": null,
      "blocks": [
        "columns-stats"
      ],
      "defaultContent": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(8)"
      ]
    },
    {
      "id": "7",
      "name": "10-Year Plan / Tennessee 511",
      "selector": [
        "#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(11)"
      ],
      "style": "dark",
      "blocks": [
        "columns-callout"
      ],
      "defaultContent": []
    },
    {
      "id": "8",
      "name": "Our TDOT People",
      "selector": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(12)"
      ],
      "style": "light-gray",
      "blocks": [
        "cards-people"
      ],
      "defaultContent": [
        "#main > div:nth-of-type(2) > div.tn-rte:nth-of-type(12)"
      ]
    },
    {
      "id": "9",
      "name": "For All The Ways That Move You",
      "selector": [
        "#main > div:nth-of-type(2) > div.tn-panel"
      ],
      "style": "panel",
      "blocks": [
        "columns-media",
        "cards-tiles"
      ],
      "defaultContent": [
        "#main > div:nth-of-type(2) > div.tn-panel > .panel > div > div.columnctrl:nth-of-type(1)"
      ]
    }
  ]
};

// TRANSFORMER REGISTRY - cleanup first, then sections (template has 2+ sections)
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration.
 * All elements are resolved up front (before any parser runs) because the
 * template uses positional nth-of-type selectors that shift once parsers
 * replace elements with block tables.
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    // 1. beforeTransform (cleanup outside #main; sections resolves its anchors)
    executeTransformers("beforeTransform", main, payload);

    // 2. Resolve ALL block elements before any parser mutates the DOM
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (final cleanup + section breaks/metadata)
    executeTransformers("afterTransform", main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement("hr");
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Sanitized path (root and the TDOT landing page /tdot map to the site homepage /index)
    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, "")
      .replace(/\.html?$/, "");
    const isHomepage = rawPath === "" || rawPath === "/tdot";
    const path = WebImporter.FileUtils.sanitizePath(isHomepage ? "/index" : rawPath);

    // 7. Images hosted in Document Authoring (downloaded locally from the report's media list)
    const media = localizeImages(main, path);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
        media,
      },
    }];
  },
};
