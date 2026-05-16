import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CSSProperties, ReactNode } from "react";

const COLORS = {
  background: "#fbfaf7",
  surface: "#ffffff",
  surfaceMuted: "#f4f2ec",
  foreground: "#0a0a0a",
  muted: "#5c5b57",
  subtle: "#8a8a85",
  border: "#e7e3dc",
  borderStrong: "#d4cfc4",
  accent: "#1d4ed8",
  accentDark: "#1e40af",
  accentSoft: "#eef2ff",
  trust: "#047857",
  trustSoft: "#d1fae5",
  warning: "#b45309",
  warningSoft: "#fef3c7",
};

const FONT_SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_SERIF = "Georgia, 'Times New Roman', serif";
const FONT_MONO = "'SFMono-Regular', 'Roboto Mono', Consolas, 'Liberation Mono', monospace";

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const sceneProgress = (frame: number, fps: number, startSeconds: number, endSeconds: number) =>
  interpolate(frame, [startSeconds * fps, endSeconds * fps], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

const fadeRange = (
  frame: number,
  fps: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
) => {
  const fadeIn = interpolate(frame, [inStart * fps, inEnd * fps], [0, 1], {
    ...clamp,
    easing: easeOut,
  });
  const fadeOut = interpolate(frame, [outStart * fps, outEnd * fps], [1, 0], {
    ...clamp,
    easing: easeInOut,
  });

  return Math.min(fadeIn, fadeOut);
};

type TimedProps = {
  children: ReactNode;
  start: number;
  end: number;
  y?: number;
  style?: CSSProperties;
};

const Timed = ({ children, start, end, y = 28, style }: TimedProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeRange(frame, fps, start, start + 0.45, end - 0.45, end);
  const lift = interpolate(opacity, [0, 1], [y, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        opacity,
        transform: `translateY(${lift}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Shell = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill
    style={{
      background: COLORS.background,
      color: COLORS.foreground,
      fontFamily: FONT_SANS,
      overflow: "hidden",
    }}
  >
    <BackgroundSystem />
    <div
      style={{
        position: "absolute",
        inset: 70,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Header />
      {children}
    </div>
  </AbsoluteFill>
);

const Header = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.9 * fps], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <div
      style={{
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 30,
        letterSpacing: "-0.02em",
      }}
    >
      <div style={{ fontFamily: FONT_SERIF, fontSize: 38 }}>FFE.</div>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 999,
          color: COLORS.muted,
          fontSize: 17,
          padding: "12px 18px",
        }}
      >
        private collaborative fine-tuning
      </div>
    </div>
  );
};

const BackgroundSystem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, 18 * fps], [0, 38], clamp);
  const pulse = Math.sin((frame / fps) * Math.PI * 0.7);

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.border} 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
          opacity: 0.38,
          transform: `translate(${-drift}px, ${drift * 0.45}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          right: -230,
          top: -190,
          background: `radial-gradient(circle, rgba(29, 78, 216, ${0.13 + pulse * 0.025}) 0%, rgba(29, 78, 216, 0.05) 42%, rgba(29, 78, 216, 0) 72%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 640,
          height: 640,
          borderRadius: "50%",
          left: -270,
          bottom: -260,
          background:
            "radial-gradient(circle, rgba(4, 120, 87, 0.12) 0%, rgba(4, 120, 87, 0.04) 46%, rgba(4, 120, 87, 0) 74%)",
        }}
      />
    </>
  );
};

const Headline = ({
  children,
  size = 86,
  maxWidth = 850,
}: {
  children: ReactNode;
  size?: number;
  maxWidth?: number;
}) => (
  <h1
    style={{
      margin: 0,
      maxWidth,
      fontFamily: FONT_SERIF,
      fontSize: size,
      fontWeight: 400,
      letterSpacing: "-0.035em",
      lineHeight: 0.95,
    }}
  >
    {children}
  </h1>
);

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      color: COLORS.subtle,
      fontFamily: FONT_MONO,
      fontSize: 20,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      marginBottom: 24,
    }}
  >
    {children}
  </div>
);

const Body = ({ children, width = 690 }: { children: ReactNode; width?: number }) => (
  <p
    style={{
      maxWidth: width,
      color: COLORS.muted,
      fontSize: 31,
      lineHeight: 1.24,
      margin: "34px 0 0",
      letterSpacing: "-0.015em",
    }}
  >
    {children}
  </p>
);

const ContributorMap = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const points = [
    { x: 180, y: 120, label: "You" },
    { x: 500, y: 70, label: "Ops" },
    { x: 765, y: 210, label: "Sales" },
    { x: 650, y: 505, label: "Legal" },
    { x: 260, y: 535, label: "Support" },
    { x: 90, y: 330, label: "Docs" },
  ];
  const core = { x: 425, y: 315 };
  const draw = sceneProgress(frame, fps, 0.7, 2.6);
  const ring = interpolate((frame % (fps * 3.2)) / fps, [0, 3.2], [0.7, 2.5], clamp);
  const ringOpacity = interpolate(
    (frame % (fps * 3.2)) / fps,
    [0, 2.1, 3.2],
    [0.42, 0.18, 0],
    clamp,
  );

  return (
    <svg width="850" height="620" viewBox="0 0 850 620" style={{ overflow: "visible" }}>
      {points.map((point, index) => {
        const local = Math.max(0, Math.min(1, draw - index * 0.08));
        const endX = point.x + (core.x - point.x) * local;
        const endY = point.y + (core.y - point.y) * local;
        const dot = (frame + index * 18) % 96;
        const travel = interpolate(dot, [0, 72, 96], [0, 1, 1], clamp);
        const dotOpacity = interpolate(dot, [0, 12, 70, 96], [0, 1, 1, 0], clamp);

        return (
          <g key={point.label}>
            <line
              x1={point.x}
              y1={point.y}
              x2={endX}
              y2={endY}
              stroke={COLORS.borderStrong}
              strokeWidth="2"
              strokeDasharray="7 12"
              opacity={0.8}
            />
            <circle
              cx={point.x + (core.x - point.x) * travel}
              cy={point.y + (core.y - point.y) * travel}
              r="7"
              fill={COLORS.accent}
              opacity={dotOpacity}
            />
          </g>
        );
      })}
      <circle
        cx={core.x}
        cy={core.y}
        r={82 * ring}
        fill="none"
        stroke={COLORS.accent}
        strokeWidth="2"
        opacity={ringOpacity}
      />
      {points.map((point, index) => {
        const pop = sceneProgress(frame, fps, 0.35 + index * 0.12, 1 + index * 0.12);
        const scale = interpolate(pop, [0, 1], [0.8, 1], clamp);

        return (
          <g
            key={point.label}
            style={{
              transform: `translate(${point.x}px, ${point.y}px) scale(${scale})`,
              transformOrigin: `${point.x}px ${point.y}px`,
              opacity: pop,
            }}
          >
            <circle r="38" fill={COLORS.trustSoft} />
            <circle r="22" fill={COLORS.surface} stroke={COLORS.trust} strokeWidth="3" />
            <text
              y="5"
              textAnchor="middle"
              fontFamily={FONT_SANS}
              fontSize="15"
              fill={COLORS.foreground}
              fontWeight="600"
            >
              {point.label}
            </text>
          </g>
        );
      })}
      <g>
        <circle cx={core.x} cy={core.y} r="82" fill={COLORS.accentSoft} />
        <circle cx={core.x} cy={core.y} r="58" fill={COLORS.accent} />
        <text
          x={core.x}
          y={core.y - 6}
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontSize="18"
          fill="#ffffff"
          fontWeight="700"
          letterSpacing="0.07em"
        >
          SHARED
        </text>
        <text
          x={core.x}
          y={core.y + 20}
          textAnchor="middle"
          fontFamily={FONT_MONO}
          fontSize="18"
          fill="#ffffff"
          fontWeight="700"
          letterSpacing="0.07em"
        >
          AI
        </text>
      </g>
    </svg>
  );
};

const EncryptedCards = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = [
    { label: "support reply", x: 0, y: 36, color: COLORS.trust },
    { label: "sales note", x: 275, y: 0, color: COLORS.accent },
    { label: "runbook", x: 550, y: 58, color: COLORS.warning },
  ];

  return (
    <div style={{ position: "relative", height: 430, marginTop: 52 }}>
      {items.map((item, index) => {
        const enter = sceneProgress(frame, fps, 3.0 + index * 0.2, 3.85 + index * 0.2);
        const lock = sceneProgress(frame, fps, 4.35 + index * 0.12, 5.25 + index * 0.12);
        const y = interpolate(enter, [0, 1], [42, 0], clamp);
        const maskWidth = interpolate(lock, [0, 1], [0, 222], clamp);

        return (
          <div
            key={item.label}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              width: 280,
              height: 270,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 22,
              background: COLORS.surface,
              boxShadow: "0 20px 60px rgba(15, 12, 6, 0.08)",
              padding: 28,
              opacity: enter,
              transform: `translateY(${y}px)`,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  index === 0
                    ? COLORS.trustSoft
                    : index === 1
                      ? COLORS.accentSoft
                      : COLORS.warningSoft,
                color: item.color,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {lock > 0.55 ? "✓" : "•"}
            </div>
            <div
              style={{
                marginTop: 28,
                color: COLORS.subtle,
                fontFamily: FONT_MONO,
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              {item.label}
            </div>
            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  style={{
                    position: "relative",
                    height: 14,
                    borderRadius: 999,
                    background: COLORS.surfaceMuted,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: row === 2 ? 145 : row === 1 ? 190 : 222,
                      height: "100%",
                      background: COLORS.borderStrong,
                      borderRadius: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: maskWidth,
                      background: item.color,
                      opacity: 0.18,
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                right: 24,
                bottom: 24,
                color: item.color,
                fontFamily: FONT_MONO,
                fontSize: 16,
                opacity: lock,
              }}
            >
              encrypted
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TrainingSystem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = sceneProgress(frame, fps, 9.2, 12.7);
  const width = interpolate(progress, [0, 1], [0, 690], clamp);
  const spin = interpolate(frame, [8.1 * fps, 13.7 * fps], [0, 360], clamp);
  const logs = ["attestation verified", "ciphertext only outside enclave", "round complete"];

  return (
    <div
      style={{
        marginTop: 54,
        display: "grid",
        gridTemplateColumns: "330px 1fr",
        gap: 42,
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 330,
          height: 330,
          borderRadius: 34,
          border: `1px solid ${COLORS.borderStrong}`,
          background: COLORS.surface,
          boxShadow: "0 20px 60px rgba(15, 12, 6, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 240,
            height: 240,
            border: `2px dashed ${COLORS.accent}`,
            borderRadius: "50%",
            opacity: 0.55,
            transform: `rotate(${spin}deg)`,
          }}
        />
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 28,
            background: COLORS.accent,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            fontFamily: FONT_MONO,
            fontWeight: 800,
            letterSpacing: "0.1em",
          }}
        >
          <div style={{ fontSize: 28 }}>TEE</div>
          <div style={{ fontSize: 15, marginTop: 8 }}>TRAIN</div>
        </div>
      </div>
      <div>
        <div
          style={{
            height: 18,
            borderRadius: 999,
            background: COLORS.surfaceMuted,
            overflow: "hidden",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              width,
              height: "100%",
              background: `linear-gradient(90deg, ${COLORS.trust}, ${COLORS.accent})`,
              borderRadius: 999,
            }}
          />
        </div>
        <div style={{ marginTop: 32, display: "grid", gap: 18 }}>
          {logs.map((log, index) => {
            const opacity = sceneProgress(frame, fps, 9.6 + index * 0.75, 10.2 + index * 0.75);
            return (
              <div
                key={log}
                style={{
                  opacity,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  color: COLORS.muted,
                  fontFamily: FONT_MONO,
                  fontSize: 23,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: COLORS.trust,
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_SANS,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
                {log}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ResultCards = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const before = sceneProgress(frame, fps, 13.6, 14.3);
  const after = sceneProgress(frame, fps, 14.4, 15.2);

  return (
    <div style={{ marginTop: 54, display: "flex", gap: 24 }}>
      {[
        { label: "before", value: "generic answer", opacity: before, color: COLORS.subtle },
        { label: "after", value: "team-trained response", opacity: after, color: COLORS.accent },
      ].map((card) => (
        <div
          key={card.label}
          style={{
            flex: 1,
            minHeight: 230,
            borderRadius: 24,
            border: `1px solid ${COLORS.borderStrong}`,
            background: COLORS.surface,
            boxShadow: "0 20px 60px rgba(15, 12, 6, 0.08)",
            padding: 30,
            opacity: card.opacity,
            transform: `translateY(${interpolate(card.opacity, [0, 1], [30, 0], clamp)}px)`,
          }}
        >
          <div
            style={{
              color: card.color,
              fontFamily: FONT_MONO,
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: FONT_SERIF,
              fontSize: 45,
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {card.value}
          </div>
          <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                style={{
                  width: row === 1 ? "86%" : row === 2 ? "64%" : "100%",
                  height: 13,
                  borderRadius: 999,
                  background: card.label === "after" ? COLORS.accentSoft : COLORS.surfaceMuted,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const FooterProgress = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const width = interpolate(frame, [0, 18 * fps], [0, 940], clamp);

  return (
    <div style={{ position: "absolute", left: 70, right: 70, bottom: 54 }}>
      <div style={{ height: 3, borderRadius: 999, background: COLORS.border }}>
        <div
          style={{
            width,
            height: "100%",
            borderRadius: 999,
            background: COLORS.accent,
          }}
        />
      </div>
    </div>
  );
};

export const FfeTwitterIntro = () => {
  return (
    <Shell>
      <main style={{ position: "relative", height: 785, marginTop: 62 }}>
        <Timed start={0.15} end={3.35}>
          <Eyebrow>Collaborative fine-tuning</Eyebrow>
          <Headline>
            Teach a shared AI,
            <br />
            <span style={{ fontStyle: "italic" }}>privately.</span>
          </Headline>
          <Body>FFE turns scattered examples into one assistant your team can actually use.</Body>
        </Timed>

        <Timed start={0.55} end={3.35} style={{ position: "absolute", right: 64, top: 230 }}>
          <ContributorMap />
        </Timed>

        <Timed start={3.35} end={7.25}>
          <Eyebrow>Private by default</Eyebrow>
          <Headline size={78}>
            Contributors add examples.
            <br />
            Browsers encrypt them first.
          </Headline>
          <EncryptedCards />
        </Timed>

        <Timed start={7.25} end={13.75}>
          <Eyebrow>No raw data pooling</Eyebrow>
          <Headline size={80}>
            Train inside a
            <br />
            verified enclave.
          </Headline>
          <Body width={780}>
            Decryption and fine-tuning happen behind the trust boundary. Outside it, examples stay
            ciphertext.
          </Body>
        </Timed>

        <Timed
          start={8.15}
          end={13.75}
          style={{ position: "absolute", left: 70, right: 70, top: 410 }}
        >
          <TrainingSystem />
        </Timed>

        <Timed start={13.15} end={16.1}>
          <Eyebrow>Co-owned output</Eyebrow>
          <Headline size={76}>
            Compare the result.
            <br />
            Ship the better assistant.
          </Headline>
          <ResultCards />
        </Timed>

        <Timed start={16.1} end={18.0}>
          <Eyebrow>FFE</Eyebrow>
          <Headline size={94} maxWidth={900}>
            Private examples.
            <br />
            Shared intelligence.
          </Headline>
          <Body width={770}>Start a collaborative fine-tune in minutes.</Body>
          <div
            style={{
              marginTop: 46,
              display: "inline-flex",
              alignItems: "center",
              gap: 16,
              borderRadius: 999,
              background: COLORS.accent,
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 30,
              padding: "22px 32px",
              letterSpacing: "-0.02em",
            }}
          >
            Create a project
            <span style={{ fontSize: 34, lineHeight: 1 }}>→</span>
          </div>
        </Timed>
      </main>
      <FooterProgress />
    </Shell>
  );
};
