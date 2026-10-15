# Background track

**Flowerbed Fields — Zane Little**, supplied by the app owner as `flowerbed_fields.ogg`. Artist/title are taken from the source's embedded metadata and shown in the music controls.

`flowerbed-fields.mp3` is a stereo 44.1 kHz / 96 kbps MP3 for browser and iPhone playback. It preserves the full 105.93-second track and is normalized to approximately **-30 LUFS**. The source measured -18.90 LUFS, so the bundled file is around 11 dB quieter before the player's additional 0.6 volume setting. Encoding the attenuation into the file also keeps iPhone Safari playback quiet when software volume is ignored. Device volume still applies.

The app loops the track without added silence. Background music is enabled by default; browser autoplay restrictions may defer it until a click or keypress. The fixed lower-right control mutes immediately and saves the choice on this device. Leaving the foreground pauses audio; returning attempts playback only when the user's preference is still on. No microphone, recording, or background-playback permissions are requested.

To reproduce the conversion from the owner-supplied original (FFmpeg with libmp3lame):

```sh
ffmpeg -i flowerbed_fields.ogg -map_metadata -1 \
  -metadata title='Flowerbed Fields' -metadata artist='Zane Little' \
  -af loudnorm=I=-30:TP=-9:LRA=7:measured_I=-18.90:measured_TP=-5.10:measured_LRA=2.20:measured_thresh=-28.90:offset=-0.38:linear=true \
  -ar 44100 -c:a libmp3lame -b:a 96k flowerbed-fields.mp3
```
