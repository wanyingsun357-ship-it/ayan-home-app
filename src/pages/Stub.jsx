import './stub.css'

// 占位页:模块还没做好之前的样子
export default function Stub({ page, back }) {
  return (
    <div className="stub">
      <header className="stub-head">
        <button className="stub-back" onClick={back}>‹</button>
        <div>
          <div className="serif stub-title">{page.title}</div>
          <div className="stub-sub">{page.sub}</div>
        </div>
      </header>
      <div className="stub-body">
        <div className="serif stub-soon">soon.</div>
        <div className="stub-hint">这个房间还在装修 🫧</div>
      </div>
    </div>
  )
}
