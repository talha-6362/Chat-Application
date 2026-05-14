import React from 'react';

const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, isForEveryone }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-80 max-w-md p-4">
        <h3 className="text-lg font-semibold mb-2">
          {isForEveryone ? 'Delete for everyone?' : 'Delete for you?'}
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          {isForEveryone 
            ? 'This message will be deleted for everyone in the chat.'
            : 'This message will be deleted from your chat only.'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog;