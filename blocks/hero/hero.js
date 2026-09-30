/**
 * hero block
 * Based on USWDS usa-hero component
 *
 * @see https://designsystem.digital.gov/components/hero/
 */

import { isLocalPreview } from '../../scripts/content-fetch.js';

/**
 * Decorates the hero block into USWDS hero component
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  // EDS "video" variant: pull the .mp4 link (background video) and the logo
  // picture out of the content before the standard hero decoration runs.
  const videoLink = [...block.querySelectorAll('a[href]')]
    .find((a) => /\.mp4(?:[?#]|$)/i.test(a.href));
  const isVideo = block.classList.contains('video') || !!videoLink;
  let videoSrc = null;
  let logo = null;
  if (isVideo) {
    block.classList.add('video');
    if (videoLink) {
      videoSrc = videoLink.href;
      // local preview serves site files (e.g. /media/*.mp4) under /content
      const videoPath = videoLink.getAttribute('href');
      if (isLocalPreview() && videoPath.startsWith('/') && !videoPath.startsWith('/content/')) {
        videoSrc = `/content${videoPath}`;
      }
      const linkParent = videoLink.parentElement;
      videoLink.remove();
      if (linkParent && linkParent.tagName === 'P' && !linkParent.textContent.trim()
        && !linkParent.children.length) linkParent.remove();
    }
    const pictures = [...block.querySelectorAll('picture')];
    // With a video source, a single picture is the logo; with two, the first is the poster.
    if (pictures.length > 1 || (videoSrc && pictures.length === 1)) {
      logo = pictures.pop();
      logo.remove();
    }
  }

  // Get the content elements from the block
  const heading = block.querySelector('h1, h2, h3');
  // first paragraph with text (an image-only paragraph is not the tagline)
  const paragraph = [...block.querySelectorAll('p')].find((p) => p.textContent.trim());
  // "banner" heroes sit below the page's own h1 (e.g. tn.gov basic slider)
  const headingTag = block.classList.contains('banner') ? 'h2' : 'h1';
  const link = block.querySelector('a');
  const picture = block.querySelector('picture');

  // Clear the block
  block.textContent = '';

  // Add USWDS class directly to the block
  block.classList.add('usa-hero');

  // Create grid container
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  // Create callout box
  const callout = document.createElement('div');
  callout.className = 'usa-hero__callout';

  // Process heading with optional "callout" prefix
  if (heading) {
    const newHeading = document.createElement(headingTag);
    newHeading.className = 'usa-hero__heading';

    // Check if heading text has a colon (e.g., "Hero callout:Rest of heading")
    const headingText = heading.textContent.trim();
    const colonIndex = headingText.indexOf(':');

    if (colonIndex > 0) {
      // Split into callout prefix and main heading
      const calloutText = headingText.substring(0, colonIndex + 1);
      const mainText = headingText.substring(colonIndex + 1).trim();

      const altSpan = document.createElement('span');
      altSpan.className = 'usa-hero__heading--alt';
      altSpan.textContent = calloutText;

      newHeading.appendChild(altSpan);
      newHeading.appendChild(document.createTextNode(mainText));
    } else {
      // No colon, use entire text as heading
      newHeading.textContent = headingText;
    }

    callout.appendChild(newHeading);
  }

  // Add paragraph
  if (paragraph) {
    const newParagraph = document.createElement('p');
    newParagraph.textContent = paragraph.textContent;
    callout.appendChild(newParagraph);
  }

  // Add call-to-action button
  if (link) {
    const button = document.createElement('a');
    button.className = 'usa-button';
    button.href = link.href;
    button.textContent = link.textContent;
    callout.appendChild(button);
  }

  // Assemble structure
  gridContainer.appendChild(callout);
  block.appendChild(gridContainer);

  // Handle background image if present
  if (picture) {
    // Position picture as background
    picture.classList.add('usa-hero__image');
    block.insertBefore(picture, block.firstChild);
  }

  // Video variant: logo above the heading, background <video> behind the callout
  if (logo) {
    const logoWrapper = document.createElement('div');
    logoWrapper.className = 'usa-hero__logo';
    logoWrapper.appendChild(logo);
    callout.insertBefore(logoWrapper, callout.firstChild);
  }

  if (videoSrc) {
    const video = document.createElement('video');
    video.className = 'usa-hero__video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.preload = 'metadata';
    const posterImg = picture && picture.querySelector('img');
    if (posterImg) video.poster = posterImg.currentSrc || posterImg.src;
    const source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) video.autoplay = true;
    block.insertBefore(video, gridContainer);
  }
}
