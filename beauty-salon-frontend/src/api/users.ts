import axiosInstance from "@/api/axios";

export const usersApi = {
  resetPassword: async (
    userId: number,
    payload: { new_password: string; new_password2: string }
  ): Promise<{ detail: string }> => {
    const res = await axiosInstance.post(`/users/${userId}/reset-password/`, payload);
    return res.data;
  },
};
