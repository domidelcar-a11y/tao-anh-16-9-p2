import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio, Character } from '../types';

// Lazily initialize the GoogleGenAI instance to allow the main App component
// to set up a mock API key in a browser environment before the first API call.
let ai: GoogleGenAI | null = null;
const getAiInstance = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
      // This will now throw at runtime during the first API call if the key is still missing,
      // which is the correct behavior, instead of throwing on module load.
      throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

export const generateImage = async (prompt: string, storyContext: string, artStyle: string, aspectRatio: AspectRatio, characterRef?: Character, previousImageBase64?: string, isVariant: boolean = false): Promise<string> => {
  try {
    let finalPrompt = `**VAI TRÒ & NHIỆM VỤ (QUAN TRỌNG NHẤT):**
BẠN LÀ một họa sĩ storyboard kỳ cựu cho các hãng phim hoạt hình hàng đầu thế giới, một bậc thầy về kể chuyện bằng hình ảnh. Nhiệm vụ của bạn không phải là "tạo ảnh", mà là **"đạo diễn từng khung hình"** để lột tả cảm xúc và câu chuyện một cách sâu sắc nhất.

---

**Bối cảnh câu chuyện tổng thể:**
${storyContext}

--- MỆNH LỆNH TỐI THƯỢỢNG (TUÂN THỦ TUYỆT ĐỐI) ---
`;
    let commandCounter = 1;

    finalPrompt += `${commandCounter++}. **CHẤT LƯỢNG NGHỆ THUẬT & ĐIỆN ẢNH:**
   - **Tư duy như đạo diễn:** Mỗi khung hình phải là một tác phẩm nghệ thuật, không phải ảnh stock.
   - **Bố cục (Composition):** Sử dụng các quy tắc điện ảnh (một phần ba, đường dẫn, khung trong khung) để tạo chiều sâu và hướng sự chú ý.
   - **Ánh sáng (Lighting):** Dùng ánh sáng để điêu khắc nhân vật, tạo không khí (mood), và dẫn dắt cảm xúc. Ánh sáng phải có mục đích.
   - **Màu sắc (Color):** Bảng màu phải củng cố cảm xúc của cảnh (ấm, lạnh, tương phản...).
   - **Diễn xuất nhân vật (Character Acting):** Biểu cảm và ngôn ngữ cơ thể phải tinh tế, chân thực, và có hồn. Lột tả nội tâm nhân vật.
   - **Không khí (Atmosphere):** Hình ảnh phải có không khí mơ mộng, nghệ thuật, giàu cảm xúc.\n`;

    if (artStyle && artStyle.trim() !== '') {
      finalPrompt += `${commandCounter++}. **PHONG CÁCH NGHỆ THUẬT BẮT BUỘC:** Toàn bộ hình ảnh phải tuân thủ nghiêm ngặt theo phong cách sau đây: **${artStyle.trim()}**. Đây là chỉ dẫn quan trọng nhất về mặt thẩm mỹ.\n`;
    }
    
    finalPrompt += `${commandCounter++}. **MỆNH LỆNH BẤT KHẢ XÂM PHẠM: HÌNH ẢNH SẠCH TUYỆT ĐỐI:**
   - **QUY TẮC VÀNG: KHÔNG VĂN BẢN:** Hình ảnh KHÔNG ĐƯỢC PHÉP chứa BẤT KỲ loại văn bản, chữ cái, hay ký tự nào. Đây là luật lệ tối cao và không có ngoại lệ.
   - **CHUYỂN HÓA LỜI THOẠI:** Nếu prompt chứa lời thoại (trong dấu "..." hoặc '...'), nhiệm vụ của bạn là **CHUYỂN HÓA** nó thành **BIỂU CẢM VÀ HÀNH ĐỘNG**. Ví dụ: thay vì viết chữ "Cứu!", hãy vẽ nhân vật đang hét lên với vẻ mặt hoảng sợ. **TUYỆT ĐỐI KHÔNG VIẾT CHỮ LÊN ẢNH.**
   - **CẤM LOGO, WATERMARK, CHỮ KÝ:** TUYỆT ĐỐI không vẽ bất kỳ logo (kể cả logo Gemini), watermark, hay chữ ký nghệ sĩ nào.
   - **HẬU QUẢ:** Việc xuất hiện dù chỉ một ký tự hay logo trên ảnh sẽ bị coi là một thất bại hoàn toàn.\n`;
    
    if (!isVariant) {
      finalPrompt += `${commandCounter++}.  **ƯU TIÊN SỰ TIẾN TRIỂN CẢNH:** Hình ảnh phải thể hiện một khoảnh khắc **HOÀN TOÀN MỚI**. Phải ưu tiên tuyệt đối cho câu lệnh của cảnh hiện tại. Bố cục, góc máy và hành động phải khác biệt rõ rệt so với cảnh trước. **KHÔNG ĐƯỢC LẶP LẠI BỐ CỤC CẢNH TRƯỚC.**\n`;
    }
    
    finalPrompt += `${commandCounter++}.  **HÀNH ĐỘNG CHÍNH XÁC 100%:** Phải phân tích kỹ và thể hiện chính xác tuyệt đối hành động được mô tả trong câu lệnh (ví dụ: "nhìn" khác với "ôm").\n\n`;


    finalPrompt += `--- QUY TẮC NHẤT QUÁN (ÁP DỤNG SAU KHI ĐÃ TUÂN THỦ MỆNH LỆNH TỐI THƯỢỢNG) ---\n\n`;
    
    // Dynamically generate consistency rules based on provided reference images
    if (characterRef && previousImageBase64) {
      finalPrompt += `**LUẬT VỀ HÌNH ẢNH THAM CHIẾU (CỰC KỲ QUAN TRỌNG):** Bạn được cung cấp HAI (2) hình ảnh tham chiếu đi kèm câu lệnh này.
- **HÌNH 1 (THAM CHIẾU NHÂN VẬT):** Đây là hình ảnh GỐC định nghĩa ngoại hình chuẩn của nhân vật **'${characterRef.name}'**. TUYỆT ĐỐI giữ nguyên 100% các đặc điểm nhận dạng (khuôn mặt, kiểu tóc, màu da, và đặc biệt là **TRANG PHỤC**). Trang phục trong hình tham chiếu là **LUẬT BẤT BIẾN** và việc thay đổi nó bị coi là một lỗi nghiêm trọng.
- **HÌNH 2 (THAM CHIẾU PHONG CÁCH):** Đây là hình ảnh của cảnh LIỀN KỀ TRƯỚC ĐÓ. BẮT BUỘC phải sao chép và áp dụng y hệt **PHONG CÁCH NGHỆ THUẬT, TÔNG MÀU, VÀ KHÔNG KHÍ ÁNH SÁNG** từ hình ảnh này. Mục tiêu là tạo ra sự liền mạch tuyệt đối, như thể hai cảnh phim được cắt từ cùng một bộ phim.
**VIỆC THAY ĐỔI NHÂN VẬT HOẶC PHONG CÁCH SO VỚI HAI HÌNH THAM CHIẾU NÀY BỊ COI LÀ LỖI NGHIÊM TRỌNG NHẤT.**\n\n`;
    } else if (characterRef) {
      finalPrompt += `**LUẬT VỀ HÌNH ẢNH THAM CHIẾU (CỰC KỲ QUAN TRỌNG):** Bạn được cung cấp MỘT (1) hình ảnh tham chiếu GỐC của nhân vật **'${characterRef.name}'**. TUYỆT ĐỐI giữ nguyên 100% các đặc điểm nhận dạng (khuôn mặt, kiểu tóc, màu da, và đặc biệt là **TRANG PHỤC**). Trang phục trong hình tham chiếu là **LUẬT BẤT BIẾN** và việc thay đổi nó bị coi là một lỗi nghiêm trọng.\n\n`;
    } else if (previousImageBase64) {
      finalPrompt += `**LUẬT VỀ HÌNH ẢNH THAM CHIẾU (CỰC KỲ QUAN TRỌNG):** Bạn được cung cấp MỘT (1) hình ảnh tham chiếu là cảnh LIỀN KỀ TRƯỚC ĐÓ. BẮT BUỘC phải sao chép và áp dụng y hệt **PHONG CÁCH NGHỆ THUẬT, TÔNG MÀU, VÀ KHÔNG KHÍ ÁNH SÁNG** từ hình ảnh này để đảm bảo sự liền mạch.\n\n`;
    }

    finalPrompt += `- **GHI NHỚ BỐI CẢNH:** Khi một địa điểm đã được thiết lập (ví dụ: một căn phòng có cái đèn), các yếu tố kiến trúc và đồ đạc chính của nó **BẮT BUỘC PHẢI ĐƯỢC GIỮ NGUYÊN** trong các cảnh sau diễn ra tại cùng địa điểm.\n`;
    finalPrompt += `- **LOGIC THỜI GIAN VÀ ĐỊA ĐIỂM:** Phải duy trì sự liên tục và hợp lý. **Hãy phân tích và tuân thủ chặt chẽ các chi tiết về thời gian (sáng, tối, ngày, đêm) và địa điểm được cung cấp.**\n\n`;
    
    finalPrompt += `--- PROMPT CỤ THỂ CHO CẢNH NÀY ---\n`;
    finalPrompt += `${prompt}`;

    const currentAi = getAiInstance();
    
    const parts: any[] = [{ text: finalPrompt }];
    
    // Add previous scene image first (will become the second image reference for the AI)
    if (previousImageBase64) {
        const base64Data = previousImageBase64.split(',')[1];
        parts.unshift({
            inlineData: {
                mimeType: 'image/png', // Assume PNG from canvas/generation
                data: base64Data,
            }
        });
    }

    // Add character master reference image second (will become the first image reference)
    if (characterRef) {
        parts.unshift({
            inlineData: {
                mimeType: characterRef.mimeType,
                data: characterRef.imageBase64,
            }
        });
    }

    const response = await currentAi.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error("No image data found in API response.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image. Check console for details.");
  }
};