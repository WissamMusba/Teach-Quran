/**
 * FILE: src/components/ads/CollapsibleBannerAd.tsx
 * ROLE: Bottom banner ad that the user can collapse to a tiny teal ▴ button
 *       (bottom-left) and re-expand anytime. The collapsed choice persists via
 *       redux-persist (settings.adCollapsed).
 * DEPENDS ON: react-native-google-mobile-ads (BannerAd), redux settingsSlice.
 * USED BY: the 9 non-reader screens: Login, Register, Dashboard (students list),
 *          StudentHub, Bookmarks, Mistakes, Notes, Settings, LoopSettings.
 * NOTES: ANCHORED_ADAPTIVE_BANNER auto-fits every device width (phones/tablets/
 *        rotation) — no hardcoded widths. requestNonPersonalizedAdsOnly stays
 *        true (education app, privacy-safe). onError unmounts silently so an
 *        offline/prod-id device never shows a crash. Reader screens
 *        (QuranView/JuzIndex/SurahIndex/Splash) deliberately have NO ad.
 */

import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useDispatch, useSelector } from 'react-redux';
import { setAdCollapsed } from '../../store/settingsSlice';

// TODO(ADMOB): replace with your REAL banner unit id from the AdMob console before release.
const PROD_BANNER_ID = 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY';
const BANNER_ID = __DEV__ ? TestIds.BANNER : PROD_BANNER_ID;

const CollapsibleBannerAd = () => {
  const dispatch = useDispatch();
  const collapsed = useSelector((s: any) => s.settings?.adCollapsed === true);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  if (collapsed) {
    return (
      <TouchableOpacity style={styles.expandBtn} onPress={() => dispatch(setAdCollapsed(false))} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.arrowUp}>{'▴'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.collapseBtn} onPress={() => dispatch(setAdCollapsed(true))} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.arrow}>{'▾'}</Text>
      </TouchableOpacity>
      <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', width: '100%' },
  collapseBtn: { position: 'absolute', left: 6, top: 6, zIndex: 10, elevation: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(18,18,20,0.75)', alignItems: 'center', justifyContent: 'center' },
  arrow: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: -1 },
  expandBtn: { position: 'absolute', left: 8, bottom: 8, zIndex: 10, elevation: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#00d4aa', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  arrowUp: { color: '#121212', fontSize: 14, fontWeight: '800', marginTop: -1 },
});

export default memo(CollapsibleBannerAd);