export function TitleBar({ profileName }: { profileName?: string }) {
  return (
    <header className="title-bar">
      <div className="title-bar-drag-region">
        <svg
          className="title-bar-icon"
          viewBox="0 0 256 256"
          aria-hidden="true"
        >
          <rect x="4" y="4" width="248" height="248" rx="12" />
          <path d="M55 65h146v24H55zM55 115h146v24H55zM55 165h129v24H55z" />
        </svg>
        <span className="title-bar-app-name">Financial Tracker</span>
        {profileName && (
          <>
            <span aria-hidden="true">—</span>
            <span className="title-bar-profile" title={profileName}>
              {profileName}
            </span>
          </>
        )}
      </div>
    </header>
  )
}
