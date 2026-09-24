export const store = {
  batches: [
    {
      id: 'batch-1',
      name: 'Batch 1',
      createdAt: new Date().toISOString(),
      students: [],
    },
    {
      id: 'batch-2',
      name: 'Batch 2',
      createdAt: new Date().toISOString(),
      students: [],
    },
  ],
  certificates: [
    {
      id: 'cert-1',
      batchId: 'batch-1',
      studentId: null,
      studentName: 'Demo Student',
      fileName: 'sample-certificate.png',
      fileUrl: 'https://placehold.co/600x400/png',
      uploadedAt: new Date().toISOString(),
    },
  ],
};
