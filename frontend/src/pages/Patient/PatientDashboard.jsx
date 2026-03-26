import { useState } from 'react';
import { getTraceabilityContract } from '../../utils/contracts';
import { getWeb3 } from '../../utils/web3';

const PatientDashboard = () => {
  const [qrCode, setQrCode] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVerificationResult(null);

    try {
      const contract = getTraceabilityContract();
      const web3 = getWeb3();
      
      // Hash the QR code
      const qrHash = web3.utils.keccak256(qrCode);
      
      const result = await contract.methods.verifyByQR(qrHash).call();
      
      if (result.isValid) {
        const batchInfo = await contract.methods.getBatchInfo(result.tokenId).call();
        setVerificationResult({
          isValid: true,
          tokenId: result.tokenId,
          ...batchInfo
        });
      } else {
        setVerificationResult({
          isValid: false,
          message: 'QR code not found or batch does not exist'
        });
      }

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        isValid: false,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>🔍 Patient Medicine Verification</h1>
      </div>

      <div className="card">
        <h2>Verify Medicine Authenticity</h2>
        <form onSubmit={handleVerify} className="form">
          <div className="form-group">
            <label>Enter QR Code Data *</label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Scan or enter QR code..."
              required
            />
            <small>Scan the QR code on your medicine package</small>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? '⏳ Verifying...' : '🔍 Verify Medicine'}
          </button>
        </form>
      </div>

      {verificationResult && (
        <div className={`card ${verificationResult.isValid ? 'success-card' : 'error-card'}`}>
          {verificationResult.isValid ? (
            <>
              <h2>✅ Authentic Medicine</h2>
              <div className="verification-details">
                <p><strong>Batch ID:</strong> #{verificationResult.tokenId}</p>
                <p><strong>Medicine:</strong> {verificationResult.medicineName}</p>
                <p><strong>Batch Number:</strong> {verificationResult.batchNumber}</p>
                <p><strong>Status:</strong> {
                  verificationResult.isRecalled ? 
                  '⚠️ RECALLED - DO NOT USE' : 
                  '✅ Safe to use'
                }</p>
              </div>
            </>
          ) : (
            <>
              <h2>❌ Verification Failed</h2>
              <p>{verificationResult.message}</p>
              <p><strong>Warning:</strong> This medicine may be counterfeit. Please contact NMRA.</p>
            </>
          )}
        </div>
      )}

      <div className="info-box">
        <h3>ℹ️ How to Verify</h3>
        <ol>
          <li>Find the QR code on your medicine package</li>
          <li>Scan it with your phone camera or enter the code manually</li>
          <li>Click "Verify Medicine" to check authenticity</li>
          <li>If marked as RECALLED, do not use the medicine</li>
        </ol>
      </div>
    </div>
  );
};

export default PatientDashboard;
