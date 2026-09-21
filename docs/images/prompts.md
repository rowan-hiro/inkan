# README illustration prompts

These illustrations were generated with the built-in imagegen tool. Each image
used a separate text prompt. The first three images used no input images; the
workflow used existing illustrations as style references, as listed below.
The generated PNGs were
encoded as WebP at quality 85 without resizing for use in README.md.

The illustrations express recording intent, preserving amendments, and carrying
context between sessions. Their seals represent declarations, not verification.

## sealed-intent.webp

```text
Use case: illustration-story
Asset type: editorial raster illustration for the Inkan open-source CLI README.
Style/medium: restrained Japanese printmaking-inspired editorial illustration, ink contours, softly layered paper shapes, subtle woodcut grain and natural washi texture. Refined and contemporary, tactile rather than vector-flat or photorealistic.
Visual language: the black ink, natural paper, and vermilion impression of a traditional Japanese registered seal. Use these same materials throughout the illustration set.
Composition/framing: wide landscape, approximately 2:1, simple and legible at 800 CSS pixels wide, generous quiet paper margin around the complete scene.
Text: none. Document contents may be suggested only by short abstract ink strokes, never legible words, letters, numerals or fake glyphs.
Constraints: this is a metaphor for recording declarations, not a certification of software correctness. No checkmarks, shields, locks, trophies, approval badges, audit gates, charts, UI screenshots, watermarks, or decorative unrelated objects.
Primary request: illustrate sealing a clearly stated intention before coding work starts.
Scene/backdrop: an open expanse of lightly textured paper.
Subject: one carefully composed document with a few distinct ink lines and a freshly applied square vermilion seal impression; a small dark carved cylindrical Japanese hanko stamp rests nearby, its form and material clearly visible. The seal impression is an abstract carved geometric mark, not text.
Lighting/mood: calm, deliberate, confident. Make the stamp and sealed paper the clear focal point. This is a welcoming cover illustration for a tool named Inkan, meaning registered seal.
```

## append-only-record.webp

```text
Use case: illustration-story
Asset type: editorial raster illustration for the Inkan open-source CLI README.
Style/medium: restrained Japanese printmaking-inspired editorial illustration, ink contours, softly layered paper shapes, subtle woodcut grain and natural washi texture. Refined and contemporary, tactile rather than vector-flat or photorealistic.
Visual language: the black ink, natural paper, and vermilion impression of a traditional Japanese registered seal. Use these same materials throughout the illustration set.
Composition/framing: wide landscape, approximately 2:1, simple and legible at 800 CSS pixels wide, generous quiet paper margin around the complete scene.
Text: none. Document contents may be suggested only by short abstract ink strokes, never legible words, letters, numerals or fake glyphs.
Constraints: this is a metaphor for recording declarations, not a certification of software correctness. No checkmarks, shields, locks, trophies, approval badges, audit gates, charts, UI screenshots, watermarks, or decorative unrelated objects.
Primary request: illustrate how an original promise stays readable while later changes are appended with their reasons.
Scene/backdrop: the same quiet lightly textured paper setting as the set.
Subject: a single gently unfolding paper record made of three connected successive panels. The first panel has distinct ink strokes and an abstract square vermilion seal. The next panels add separate short groups of ink strokes, each separated by generous blank space. The first panel remains intact and visible, with no erasure or overwritten writing. Small repeated vermilion margin marks and the continuous paper connect the panels.
Lighting/mood: clear, patient, cumulative. This is an editorial paper-and-ink scene, not a labeled workflow diagram. No arrows or labels.
```

## session-handoff.webp

```text
Use case: illustration-story
Asset type: editorial raster illustration for the Inkan open-source CLI README.
Style/medium: restrained Japanese printmaking-inspired editorial illustration, ink contours, softly layered paper shapes, subtle woodcut grain and natural washi texture. Refined and contemporary, tactile rather than vector-flat or photorealistic.
Visual language: the black ink, natural paper, and vermilion impression of a traditional Japanese registered seal. Use these same materials throughout the illustration set.
Composition/framing: wide landscape, approximately 2:1, simple and legible at 800 CSS pixels wide, generous quiet paper margin around the complete scene.
Text: none. Document contents may be suggested only by short abstract ink strokes, never legible words, letters, numerals or fake glyphs.
Constraints: this is a metaphor for recording declarations, not a certification of software correctness. No checkmarks, shields, locks, trophies, approval badges, audit gates, charts, UI screenshots, watermarks, or decorative unrelated objects.
Primary request: illustrate durable project context being passed from one coding session to the next.
Scene/backdrop: the same quiet lightly textured paper setting as the set.
Subject: two simple cropped hands pass an open project folder containing the same clearly visible ink-lined paper record with an abstract square vermilion seal. One hand releases the folder as the other receives it; the intact document remains central and readable as an object. Only the hands, folder and papers are present. Hands have natural, coherent anatomy.
Lighting/mood: calm continuity and an easy handoff, with the written record carrying the context. Avoid glowing brains, robot mascots, network clouds and approval symbolism.
```

## workflow.webp

Style references: `docs/images/sealed-intent.webp` and
`docs/images/append-only-record.webp`. These supplied visual style only; the
workflow is a new image.

```text
Use case: infographic-diagram
Asset type: illustrated usage workflow for the English README of Inkan, a lightweight record-keeping CLI for people and coding agents collaborating.
Primary request: create a NEW illustrated workflow that replaces a plain Mermaid chart, matching the supplied paper-and-ink illustrations closely.
Input images: Image 1 (sealed-intent.webp) and Image 2 (append-only-record.webp) are STYLE REFERENCES ONLY. Match their warm washi paper, black ink, tactile printmaking grain, vermilion stamp impressions, and softly shaded hand-drawn objects. Do not modify or duplicate the reference compositions.
Scene/backdrop: one cohesive expanse of warm, lightly textured paper. The workflow should feel like an illustrated printed page with small paper documents and seal objects, not a corporate diagram of rounded rectangles.
Composition/framing: landscape about 3:2, with generous outer margins. A clear left-to-right main path of FOUR equally prominent illustrated stations across the middle/lower area. Two smaller supporting notes above the work station show resumption and optional amendment. Keep connectors separate, easy to follow, and free of crossings. Use large, crisp dark typography legible when the whole image is displayed at 900 pixels wide; commands and short labels matter more than dense detail.
Main path, in exact order:
1. A sealed paper and small hanko stamp. Text: "Seal", "inkan begin", "Outcome + criteria", "Link decisions".
2. An open working sheet with a pen. Text: "Work", "People + agents", "Repository checks".
3. A paper record with a closing note, no approval marks. Text: "Close", "inkan end", "Met / unmet + note".
4. A neatly gathered set of project papers. Text: "Commit", "git commit", "Work + record", "Inkan-Outcome trailer".
Draw fine, hand-inked arrows from Seal to Work, Work to Close, and Close to Commit. Label the Work-to-Close arrow exactly "When ready".
Supporting note A above the main path: a small open paper folder, label "Resume", with two command lines "inkan status" and "inkan log". A single arrow from this note enters Work; it does not lead to Seal.
Supporting note B above Work: a small appended paper slip, label "Scope changes", command "inkan amend --reason", and caption "Record before doing". An optional vermilion loop runs from Work to this note and back to Work, without connecting to Close. This is an optional detour, not a mandatory step.
Style/medium: delicate Japanese woodcut-inspired editorial artwork with real paper grain, restrained black contours and muted vermilion accents, matching the references. Objects are subtle supporting illustrations, not clip-art icons. Labels are typeset, crisp and horizontal, not brush calligraphy.
Text: render ONLY the quoted English labels and commands specified above, exactly as written, with no invented words, captions, title, decorative kanji, pseudo-text, or watermarks. Inkan is spelled I-n-k-a-n. Use a readable monospaced face for CLI commands and a clean editorial face for labels. Do not hide text inside skewed or foreshortened paper objects.
Constraints: the seal records a declaration; it does not certify correctness. Tests are run by the people/agents and repository tooling, never by Inkan. No checkmarks, shields, padlocks, certification badges, automated pass/fail verdicts, audit stages, robots, UI screenshots, neon colors, shiny 3D, or heavy flowchart boxes. Preserve all six workflow elements and the arrow directions described.
```
