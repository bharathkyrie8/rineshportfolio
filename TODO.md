# Fix Portfolio Errors - Task List

## assets/js/custom-gsap.js
- [x] 1. Fix `.tw-itm-title tw-itm-anim` → `.tw-itm-title.tw-itm-anim` (2 places)
- [x] 2. Fix `desktop_three` missing closing `)`
- [x] 3. Remove undefined `TweenMax` from `gsap.registerPlugin`
- [x] 4. Replace `setInterval(moveImage(...))` bug with `requestAnimationFrame`

## works.html
- [x] 5. Close misplaced `@media (max-width: 1199px)` block after `.banner-three-center` so header/works-card styles apply globally

## Follow-up
- [x] Verify the site renders correctly with no console errors
