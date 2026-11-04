interface LogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  textClassName?: string;
}

export function AppLogo({ size = 40, className = '', withText = true, textClassName = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/aja_app_logo.svg"
        alt="AJA' APP Logo"
        style={{ height: size, width: 'auto' }}
        className="object-contain"
      />
      {withText && (
        <span className={`font-extrabold leading-tight ${textClassName}`}>
          <span className="text-[#21638b]">AJA' APP</span>
        </span>
      )}
    </div>
  );
}

export function AppLogoMark({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/aja_app_logo.svg"
      alt="AJA' APP Logo"
      style={{ height: size, width: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
