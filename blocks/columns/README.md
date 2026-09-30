# columns

Custom **columns** block. Purpose: columns-multi-layout.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one or more rows, each with 2-4 cells; cells hold headings, paragraphs, link lists, buttons, or a picture.

## Supported variations

| Variation | Option class |
| --- | --- |
| Links | `links` |
| Feature | `feature` |
| Stats | `stats` |
| Callout | `callout` |
| Media | `media` |

## Universal Editor fields

N/A (Document Authoring project)

<!-- excat-authoring-guide:start -->
## Migration authoring guide

### Supported variations

| Variation | Option class | Content |
| --- | --- | --- |
| Contact | `contact` | One row, two cells: photo (+ italic caption paragraph) \| contact details. Desktop 2/3 + 1/3; the second cell renders as a white card. |
| Link lists | `link-lists` | One row per group of up to 4 lists. Each cell: H2 (optionally linked) + list of links + optional "See More" link paragraph. Title rules cycle orange, blue, green, red by column. |
| Links, Feature, Stats, Callout, Media | `links`, `feature`, `stats`, `callout`, `media` | Homepage column controls. |
<!-- excat-authoring-guide:end -->

