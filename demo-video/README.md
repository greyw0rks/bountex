# Bountex walkthrough

The final editable composition is in [hyperframes/](hyperframes/). It combines eight recorded application screens with the saved ElevenLabs narration. The sample workflow and receipt stay visibly labeled. The public closing screen uses mainnet; native signed login was confirmed by the builder on November 5, 2026, and a real reward transfer remains to be tested.

```bash
cd demo-video/hyperframes
npm run dev
npm run check
npm run render -- --quality delivery -o ../output/bountex-walkthrough.mp4
```

The scripts pin HyperFrames 0.9.16. Fonts, footage, narration and GSAP are local assets. The project retains separate scene files and editable titles. English captions are provided in WebVTT and SRT alongside the exported MP4.

The initial Sequence Studio draft is retained in `sequence-project.json` and `sequence-media/` locally. `scripts/assemble.mjs` can recreate that draft while Sequence Studio's local API is running. It predates the builder's successful native-login test; use the HyperFrames composition for the current walkthrough.

`scripts/capture.mjs` and `scripts/narrate.mjs` produced the source recordings and narration. `scripts/prepare-hyperframes.mjs` reuses those saved inputs. They are ignored in Git because they include intermediate recordings and audio; the render-ready composition's media is versioned separately. Regenerating narration uses an external credential and provider usage; it is unnecessary for rerendering the saved composition.
