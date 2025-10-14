function BorderAnimatedContainer({ children }) {
  return (
    <div
      className="
        w-full h-full
        rounded-2xl border border-transparent
        [background:conic-gradient(from_var(--border-angle),theme(colors.cyan.400),theme(colors.pink.500),theme(colors.cyan.400))_border-box]
        bg-slate-900
        animate-border
        p-[2px] 
      "
    >
      <div className="rounded-2xl bg-slate-900 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export default BorderAnimatedContainer;
