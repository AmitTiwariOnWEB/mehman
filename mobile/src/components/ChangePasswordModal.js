import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { authApi } from "../lib/api";

/**
 * ChangePasswordModal (React Native)
 * Props:
 *   visible        – boolean
 *   token          – access token string
 *   forced         – boolean, if true no close button shown
 *   onSuccess      – callback after successful change
 *   onClose        – callback to dismiss (only when forced=false)
 */
export function ChangePasswordModal({ visible, token, forced = false, onSuccess, onClose }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setError(""); setLoading(false); setDone(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!currentPw || !newPw || !confirmPw) {
      setError("All fields are required.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw === currentPw) {
      setError("New password must be different from current password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(token, { currentPassword: currentPw, newPassword: newPw });
      setDone(true);
      setTimeout(() => {
        reset();
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (forced) return;
    reset();
    if (onClose) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{forced ? "Set New Password" : "Change Password"}</Text>
                {forced && <Text style={styles.subtitle}>Required before continuing</Text>}
              </View>
              {!forced && (
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {forced && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  For security, please change your password before using the app.
                </Text>
              </View>
            )}

            {done ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>Password changed successfully!</Text>
              </View>
            ) : (
              <>
                <PwField
                  label="Current Password"
                  value={currentPw}
                  onChange={setCurrentPw}
                  show={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                />
                <PwField
                  label="New Password"
                  value={newPw}
                  onChange={setNewPw}
                  show={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                />
                <PwField
                  label="Confirm New Password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  show={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                />

                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (loading || !currentPw || !newPw || !confirmPw) && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || !currentPw || !newPw || !confirmPw}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PwField({ label, value, onChange, show, onToggle }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          style={styles.fieldInput}
          placeholderTextColor="#94a3b8"
          placeholder="••••••••"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <Text style={styles.eyeBtnText}>{show ? "🙈" : "👁"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center"
  },
  closeBtnText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "600"
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  warningText: {
    fontSize: 13,
    color: "#92400e"
  },
  fieldWrapper: {
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    height: 48
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    ...Platform.select({ web: { outline: "none" } })
  },
  eyeBtn: {
    paddingLeft: 8
  },
  eyeBtnText: {
    fontSize: 16
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c"
  },
  successBox: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginVertical: 8
  },
  successText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803d"
  },
  submitBtn: {
    backgroundColor: "#06284f",
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6
  },
  submitBtnDisabled: {
    opacity: 0.55
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  }
});
