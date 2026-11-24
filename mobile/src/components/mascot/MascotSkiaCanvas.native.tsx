import React from 'react';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  RoundedRect,
  Skia,
  type SkPath,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import {
  ALERT_LINES,
  BODY_FILL_PATHS,
  BODY_STROKE_PATHS,
  BOWTIE_WING_PATHS,
  HAPPY_EYE_PATHS,
  HAT_BRIM_PATH,
  MASCOT_VIEWBOX_SIZE,
  SLEEPING_EYE_PATHS,
  SPARKLE_CROSS_PATHS,
  SPARKLE_DOTS,
  THINKING_DOTS,
  ZZZ_PATHS,
} from './mascotGeometry';
import type { MascotAnimationState, MascotSkin } from './mascotPalettes';
import type { MascotAnimValues } from './mascotAnimationBuilders';

const DEG2RAD = Math.PI / 180;

function compilePath(d: string): SkPath {
  const p = Skia.Path.MakeFromSVGString(d);
  return p ?? Skia.Path.Make();
}

const SK_BODY_FILLS = BODY_FILL_PATHS.map(compilePath);
const SK_BODY_STROKES = BODY_STROKE_PATHS.map(compilePath);
const SK_BOWTIE_WINGS = BOWTIE_WING_PATHS.map(compilePath);
const SK_HAPPY_EYES = HAPPY_EYE_PATHS.map(compilePath);
const SK_SLEEPING_EYES = SLEEPING_EYE_PATHS.map(compilePath);
const SK_HAT_BRIM = compilePath(HAT_BRIM_PATH);
const SK_SPARKLES = SPARKLE_CROSS_PATHS.map(compilePath);
const SK_ZZZ = ZZZ_PATHS.map((z) => compilePath(z.d));

export interface MascotSkiaCanvasProps {
  size: number;
  resolvedState: MascotAnimationState;
  colors: Required<MascotSkin>;
  isCompact: boolean;
  isNotification: boolean;
  anim: MascotAnimValues;
}

/**
 * Renderizador GPU Skia do rig 500x500 do Vito (Android/iOS).
 * Todas as transformações derivam diretamente de Reanimated SharedValues na UI thread.
 */
export const MascotSkiaCanvas: React.FC<MascotSkiaCanvasProps> = ({
  size,
  resolvedState,
  colors: c,
  isCompact,
  isNotification,
  anim,
}) => {
  const scaleFactor = size / MASCOT_VIEWBOX_SIZE;

  const wholeTransform = useDerivedValue(() => [
    { translateX: anim.wholeX.value },
    { translateY: anim.wholeY.value },
    { rotate: anim.wholeRotate.value * DEG2RAD },
  ]);

  const bowtieTransform = useDerivedValue(() => [
    { translateX: anim.bowtieX.value },
    { translateY: anim.bowtieY.value },
    { rotate: anim.bowtieRotate.value * DEG2RAD },
    { scale: anim.bowtieScale.value },
  ]);

  const eyesTransform = useDerivedValue(() => [
    { translateX: anim.eyesX.value },
    { translateY: anim.eyesY.value },
  ]);

  const eyeLeftTransform = useDerivedValue(() => [
    { scaleX: anim.eyeLeftScale.value },
    { scaleY: anim.eyeLeftScale.value * anim.eyeLeftScaleY.value },
  ]);

  const eyeRightTransform = useDerivedValue(() => [
    { scaleX: anim.eyeRightScale.value },
    { scaleY: anim.eyeRightScale.value * anim.eyeRightScaleY.value },
  ]);

  const hatTransform = useDerivedValue(() => [
    { translateX: anim.hatX.value },
    { translateY: anim.hatY.value },
    { rotate: anim.hatRotate.value * DEG2RAD },
  ]);

  const sparkleTransform = useDerivedValue(() => [
    { translateY: anim.fxSparkleY.value },
    { scale: anim.fxSparkleScale.value },
  ]);

  const alertTransform = useDerivedValue(() => [{ scale: anim.fxAlertScale.value }]);
  const dot1Transform = useDerivedValue(() => [{ translateY: anim.fxDot1Y.value }]);
  const dot2Transform = useDerivedValue(() => [{ translateY: anim.fxDot2Y.value }]);
  const dot3Transform = useDerivedValue(() => [{ translateY: anim.fxDot3Y.value }]);
  const z1Transform = useDerivedValue(() => [
    { translateX: anim.fxZ1X.value },
    { translateY: anim.fxZ1Y.value },
  ]);
  const z2Transform = useDerivedValue(() => [
    { translateX: anim.fxZ2X.value },
    { translateY: anim.fxZ2Y.value },
  ]);
  const z3Transform = useDerivedValue(() => [
    { translateX: anim.fxZ3X.value },
    { translateY: anim.fxZ3Y.value },
  ]);

  const showHappyEyes = resolvedState === 'happy';
  const showSleepingEyes = resolvedState === 'sleeping';
  const showDefaultEyes = !showHappyEyes && !showSleepingEyes;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: scaleFactor }]}>
        <Group origin={vec(250, 280)} transform={wholeTransform}>
          {!isCompact && resolvedState === 'happy' ? (
            <Group
              origin={vec(250, 180)}
              transform={sparkleTransform}
              opacity={anim.fxSparkleOpacity}
            >
              {SK_SPARKLES.map((p, idx) => (
                <Path
                  key={idx}
                  path={p}
                  color={c.bowtie}
                  style="stroke"
                  strokeWidth={10}
                  strokeCap="round"
                />
              ))}
              {SPARKLE_DOTS.map((pt, idx) => (
                <Circle key={idx} cx={pt.cx} cy={pt.cy} r={pt.r} color={c.bowtie} />
              ))}
            </Group>
          ) : null}

          {!isCompact && resolvedState === 'surprised' ? (
            <Group origin={vec(120, 90)} transform={alertTransform} opacity={anim.fxAlertOpacity}>
              {ALERT_LINES.map((ln, idx) => (
                <Line
                  key={idx}
                  p1={vec(ln.x1, ln.y1)}
                  p2={vec(ln.x2, ln.y2)}
                  color={c.bowtie}
                  strokeWidth={12}
                  strokeCap="round"
                />
              ))}
            </Group>
          ) : null}

          {!isCompact && resolvedState === 'thinking' ? (
            <Group>
              {[
                { dot: THINKING_DOTS[0], tr: dot1Transform, op: anim.fxDot1Opacity },
                { dot: THINKING_DOTS[1], tr: dot2Transform, op: anim.fxDot2Opacity },
                { dot: THINKING_DOTS[2], tr: dot3Transform, op: anim.fxDot3Opacity },
              ].map((item, idx) => (
                <Group
                  key={idx}
                  origin={vec(item.dot.cx, item.dot.cy)}
                  transform={item.tr}
                  opacity={item.op}
                >
                  <Circle cx={item.dot.cx} cy={item.dot.cy} r={item.dot.r} color={c.fill} />
                  <Circle
                    cx={item.dot.cx}
                    cy={item.dot.cy}
                    r={item.dot.r}
                    color={c.stroke}
                    style="stroke"
                    strokeWidth={10}
                  />
                </Group>
              ))}
            </Group>
          ) : null}

          {!isCompact && resolvedState === 'sleeping' ? (
            <Group>
              {[
                { path: SK_ZZZ[0], meta: ZZZ_PATHS[0], tr: z1Transform, op: anim.fxZ1Opacity },
                { path: SK_ZZZ[1], meta: ZZZ_PATHS[1], tr: z2Transform, op: anim.fxZ2Opacity },
                { path: SK_ZZZ[2], meta: ZZZ_PATHS[2], tr: z3Transform, op: anim.fxZ3Opacity },
              ].map((item, idx) => (
                <Group
                  key={idx}
                  origin={vec(item.meta.ox, item.meta.oy)}
                  transform={item.tr}
                  opacity={item.op}
                >
                  <Path
                    path={item.path}
                    color={c.stroke}
                    style="stroke"
                    strokeWidth={10}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                </Group>
              ))}
            </Group>
          ) : null}

          {/* Corpo 500x500 */}
          <Group>
            {SK_BODY_FILLS.map((p, idx) => (
              <Path key={`bf-${idx}`} path={p} color={c.fill} style="fill" />
            ))}
            {SK_BODY_STROKES.map((p, idx) => (
              <Path
                key={`bs-${idx}`}
                path={p}
                color={c.stroke}
                style="stroke"
                strokeWidth={16.5}
                strokeCap="round"
                strokeJoin="round"
              />
            ))}
          </Group>

          {/* Gravata borboleta */}
          <Group origin={vec(250, 316)} transform={bowtieTransform}>
            {SK_BOWTIE_WINGS.map((p, idx) => (
              <Path key={`bw-${idx}`} path={p} color={c.bowtie} style="fill" />
            ))}
            <RoundedRect x={239} y={304} width={22} height={24} r={7} color={c.bowtie} />
          </Group>

          {/* Olhos */}
          <Group origin={vec(250, 211.5)} transform={eyesTransform}>
            {showDefaultEyes ? (
              <Group>
                <Group origin={vec(209, 211.5)} transform={eyeLeftTransform}>
                  <RoundedRect x={195} y={176} width={28} height={71} r={14} color={c.eyes} />
                </Group>
                <Group origin={vec(291, 211.5)} transform={eyeRightTransform}>
                  <RoundedRect x={277} y={176} width={28} height={71} r={14} color={c.eyes} />
                </Group>
              </Group>
            ) : null}

            {showHappyEyes ? (
              <Group>
                {SK_HAPPY_EYES.map((p, idx) => (
                  <Path
                    key={`he-${idx}`}
                    path={p}
                    color={c.eyes}
                    style="stroke"
                    strokeWidth={18}
                    strokeCap="round"
                  />
                ))}
              </Group>
            ) : null}

            {showSleepingEyes ? (
              <Group>
                {SK_SLEEPING_EYES.map((p, idx) => (
                  <Path
                    key={`se-${idx}`}
                    path={p}
                    color={c.eyes}
                    style="stroke"
                    strokeWidth={16}
                    strokeCap="round"
                  />
                ))}
              </Group>
            ) : null}
          </Group>

          {/* Cartola */}
          <Group origin={vec(332, 104)} transform={hatTransform}>
            <Group transform={[{ translateX: 332 }, { translateY: 92 }, { rotate: 27.5 * DEG2RAD }]}>
              {isNotification ? (
                <RoundedRect x={-32} y={-12} width={64} height={14} r={3} color={c.band} />
              ) : (
                <Group>
                  <RoundedRect x={-42} y={-64} width={84} height={66} r={22} color={c.hat} />
                  <RoundedRect
                    x={-42}
                    y={-64}
                    width={84}
                    height={66}
                    r={22}
                    color={c.hat}
                    style="stroke"
                    strokeWidth={8}
                  />
                  <RoundedRect x={-33} y={-18} width={66} height={14} r={2} color={c.band} />
                  <Path
                    path={SK_HAT_BRIM}
                    color={c.hat}
                    style="stroke"
                    strokeWidth={15}
                    strokeCap="round"
                  />
                </Group>
              )}
            </Group>
          </Group>
        </Group>
      </Group>
    </Canvas>
  );
};
