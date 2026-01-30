import { NextResponse } from 'next/server';
import vectorDb from '@/lib/vectorDb';

// Get list of all uploaded documents
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    if (source) {
      // Get specific document info
      const chunks = await vectorDb.getAllBySource(source);
      
      return NextResponse.json({
        success: true,
        filename: source,
        chunks: chunks.length,
      });
    }

    // This is a simplified version - in production, you'd maintain a separate index
    return NextResponse.json({
      success: true,
      message: 'Use the source parameter to get document details',
    });
  } catch (error) {
    console.error('Error getting documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get documents' },
      { status: 500 }
    );
  }
}

// Delete a document
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    await vectorDb.deleteBySource(filename);

    return NextResponse.json({
      success: true,
      message: `Document ${filename} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
