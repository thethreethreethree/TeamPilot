/**
 * A control that opens the website, for the few things the phone cannot do.
 *
 * ONE COMPONENT BECAUSE THERE ARE THREE CALL SITES, and the third would have
 * been the point at which they started to drift — one of them handling a failed
 * browser open and the others silently doing nothing.
 *
 * IT RENDERS NOTHING WITHOUT A URL. A build with no API base has no website to
 * send anyone to, and a control that opened the site's 404 would read to a rep
 * as the thing having been deleted. Absent is honest; broken is not.
 *
 * THE FAILURE MESSAGE NAMES THE DESTINATION IN WORDS, so somebody whose phone
 * will not open a browser can still get there on a laptop. "Could not open"
 * alone would leave them with a dead end and no address.
 */
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export function WebsiteLink({
  url,
  label,
  spoken,
  /** Where to tell them to look if the browser will not open. Plain words. */
  whereInstead,
}: {
  url: string | null;
  /** What the control says. A promise about where it goes — never "Learn more". */
  label: string;
  /** The same thing said in full for a screen reader, which hears it alone. */
  spoken: string;
  whereInstead: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;

  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={spoken}
        onPress={() => {
          setFailed(false);
          WebBrowser.openBrowserAsync(url).catch(() => setFailed(true));
        }}
        // 44pt, the platform minimum, even though the text is small.
        className="mt-1 min-h-11 justify-center active:opacity-70"
      >
        <Text className="font-emphasis text-sm text-primary">{label}</Text>
      </Pressable>
      {failed ? (
        <Text
          accessibilityRole="alert"
          className="font-body text-sm leading-relaxed text-foreground"
        >
          Could not open a browser. {whereInstead}
        </Text>
      ) : null}
    </>
  );
}
