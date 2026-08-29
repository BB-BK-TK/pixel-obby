# Pixel Obby — Google Play release notes

## App identity
- App name: Pixel Obby
- Package/application ID (proposed): `com.bbkbtk.pixelobby`
- Version: 1.0.0 (versionCode 1)
- Category: Game / Casual
- Default language: English (United States)
- Website: https://bb-bk-tk.github.io/pixel-obby/
- Privacy policy: https://bb-bk-tk.github.io/pixel-obby/privacy.html

> The package ID becomes effectively permanent after the first Play upload. Change it before the first upload if needed.

## Store listing

### Short description
Endless pixel obstacle courses that get harder every level.

### Full description
Pixel Obby is a fast, simple obstacle-course game with millions of level variations.

Jump across platforms, dodge hazards, hit checkpoints, and reach the flag. Each obby gets a little harder as you progress.

Features:
- Endless procedurally generated obstacle courses
- Increasing difficulty as you advance
- Checkpoints, spikes, moving platforms, and lava hazards
- XP rewards for completing obbies
- Unlockable avatars and cosmetic items
- Replay previously reached obbies
- Touch controls designed for landscape play
- Guest progress saved on your device
- Optional cloud save for progress across devices

No pay-to-win mechanics. Cosmetic items use XP earned by playing.

## Required graphics
- Play Store app icon: 512 x 512 PNG, <= 1 MB
- Feature graphic: 1024 x 500 PNG/JPEG
- Minimum 2 screenshots to publish
- Recommended for games: at least 3 landscape screenshots at 1920 x 1080 or higher

Suggested screenshots:
1. In-game jump/platform scene with HUD
2. Later obby with hazards/checkpoint
3. Market showing avatars/items
4. My Obbies/replay screen

## App content / policy starting point

### Ads
- Declare: No, unless advertising is added before release.

### App access
- Core gameplay requires no login.
- Optional Save Online uses a parent-managed email magic link.
- Reviewer can test the full core game in guest mode without credentials.

### Data safety — current implementation
Guest mode stores game progress locally on the device.

If optional Save Online remains enabled in the Play build, disclose:
- Email address: collected for account authentication
- User ID/account identifier: collected for account/cloud sync
- App activity/game progress and obby history: collected for cloud-save functionality
- Data is not sold and is not used for advertising
- Account/cloud-data deletion is available in the account screen

Re-check this section immediately before submission against the actual production build and any third-party SDKs/services.

### Target audience
Choose deliberately in Play Console. If the app is declared as targeting children, Google Play Families requirements apply. Do not select a child audience only because the game is child-friendly; select the intended audience of the published product.

### Content rating
Complete the Play Console content-rating questionnaire based on the actual game content. Current gameplay contains stylized non-graphic hazards (spikes/lava) and no realistic violence.

## TWA / Digital Asset Links
The Android wrapper launches:
`https://bb-bk-tk.github.io/pixel-obby/`

For verified fullscreen Trusted Web Activity behavior, publish a Digital Asset Links file at the ORIGIN ROOT:
`https://bb-bk-tk.github.io/.well-known/assetlinks.json`

Because the game is hosted under a GitHub Pages project path, the asset-links file belongs to the root `bb-bk-tk.github.io` site, not inside `/pixel-obby/`.

After the first Play upload, use the SHA-256 fingerprint of the Google Play App Signing certificate in `assetlinks.json`.

## Release sequence
1. Confirm final package ID before first Play upload.
2. Build and sign a release AAB.
3. Create the Pixel Obby app in Play Console.
4. Upload AAB to Internal testing first.
5. Enable Play App Signing and copy the app-signing SHA-256 certificate fingerprint.
6. Publish root-domain `.well-known/assetlinks.json` with package ID + Play signing fingerprint.
7. Verify TWA opens without browser UI.
8. Complete Store listing, Privacy policy, Data safety, Ads, App access, Target audience, and Content rating.
9. If this is a new personal developer account created after Nov 13, 2023, run the required closed test (12 opted-in testers continuously for 14 days) before requesting Production access.
10. Submit for production review once eligible.
