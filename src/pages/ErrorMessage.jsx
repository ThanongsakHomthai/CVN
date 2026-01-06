import "../styles/Pages.css";

const ErrorMessage = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Error Message</h1>
        <p>ข้อความแจ้งเตือนและข้อผิดพลาดของระบบ</p>
      </div>
      <div className="page-content">
        <div className="card">
          <h2>ข้อความแจ้งเตือน</h2>
          <p>เนื้อหาหน้านี้จะถูกเพิ่มในภายหลัง</p>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;

